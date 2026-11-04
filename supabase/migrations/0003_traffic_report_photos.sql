-- Replace the standalone AI Vision feature with optional photo evidence on traffic reports.
-- Existing files in Storage are preserved; this migration only removes AI metadata/quota tables.

drop function if exists public.consume_ai_analysis_quota();
drop table if exists public.ai_analyses;
drop table if exists public.ai_usage_by_hour;

create or replace function public.expire_stale_traffic_reports()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
begin
  update public.traffic_reports set status = 'expired', version = version + 1
  where status = 'active' and expires_at <= pg_catalog.now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

create or replace function public.can_read_traffic_report_photo(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.traffic_reports as report
    where report.image_path = p_object_name
      and report.status = 'active'
      and report.expires_at > pg_catalog.now()
  );
$function$;
revoke all on function public.can_read_traffic_report_photo(text) from public, anon;
grant execute on function public.can_read_traffic_report_photo(text) to authenticated;

drop policy if exists traffic_images_read_own on storage.objects;
create policy traffic_images_read_own on storage.objects
  for select to authenticated using (
    bucket_id = 'traffic-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.can_read_traffic_report_photo(name)
    )
  );

drop function public.get_traffic_reports_bbox(double precision,double precision,double precision,double precision);
create function public.get_traffic_reports_bbox(
  p_min_lat double precision,
  p_min_lng double precision,
  p_max_lat double precision,
  p_max_lng double precision
)
returns table (
  id uuid, incident_type text, severity text, lat double precision, lng double precision,
  note text, gps_accuracy_m double precision, heading_deg double precision,
  status text, created_at timestamptz, expires_at timestamptz, version integer, image_path text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if p_min_lat is null or p_min_lng is null or p_max_lat is null or p_max_lng is null
    or p_min_lat < -90 or p_min_lat > 90 or p_max_lat < -90 or p_max_lat > 90
    or p_min_lng < -180 or p_min_lng > 180 or p_max_lng < -180 or p_max_lng > 180
    or p_min_lat >= p_max_lat or p_min_lng >= p_max_lng
    or p_max_lat - p_min_lat > 2 or p_max_lng - p_min_lng > 2 then
    raise exception using errcode = '22023', message = 'Invalid or oversized traffic bounds';
  end if;

  return query
  select report.id, report.incident_type, report.severity,
    extensions.st_y(report.geom::extensions.geometry),
    extensions.st_x(report.geom::extensions.geometry),
    report.note, report.gps_accuracy_m, report.heading_deg, 'active'::text,
    report.created_at, report.expires_at, report.version, report.image_path
  from public.traffic_reports as report
  where report.status = 'active'
    and report.expires_at > pg_catalog.now()
    and extensions.st_intersects(
      report.geom,
      extensions.st_makeenvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::extensions.geography
    )
  order by report.created_at desc
  limit 200;
end;
$function$;
revoke all on function public.get_traffic_reports_bbox(double precision,double precision,double precision,double precision) from public;
grant execute on function public.get_traffic_reports_bbox(double precision,double precision,double precision,double precision) to anon, authenticated;

drop function public.create_traffic_report(text,text,double precision,double precision,text,double precision,double precision);
create function public.create_traffic_report(
  p_incident_type text,
  p_severity text,
  p_lat double precision,
  p_lng double precision,
  p_note text default null,
  p_gps_accuracy_m double precision default null,
  p_heading_deg double precision default null,
  p_image_path text default null
)
returns table (
  id uuid, incident_type text, severity text, lat double precision, lng double precision,
  note text, gps_accuracy_m double precision, heading_deg double precision,
  status text, created_at timestamptz, expires_at timestamptz, version integer, image_path text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_report public.traffic_reports%rowtype;
  v_ttl interval;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_incident_type is null or p_severity is null or p_lat is null or p_lng is null
    or p_incident_type not in ('traffic_jam','accident','construction','flood','road_closure','obstacle')
    or p_severity not in ('low','medium','high')
    or p_lat not between -90 and 90 or p_lng not between -180 and 180
    or (p_note is not null and char_length(p_note) > 300)
    or (p_gps_accuracy_m is not null and p_gps_accuracy_m not between 0 and 100000)
    or (p_heading_deg is not null and (p_heading_deg < 0 or p_heading_deg >= 360))
    or (p_image_path is not null and p_image_path !~ (
      '^' || v_user_id::text || '/traffic-reports/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp)$'
    )) then
    raise exception using errcode = '22023', message = 'Invalid traffic report';
  end if;
  if exists (
    select 1 from public.traffic_reports as recent
    where recent.user_id = v_user_id and recent.created_at > pg_catalog.now() - interval '1 minute'
  ) then
    raise exception using errcode = 'P0001', message = 'REPORT_RATE_LIMIT: Chờ một phút trước khi gửi báo cáo tiếp theo';
  end if;
  if (select count(*) from public.traffic_reports as recent
      where recent.user_id = v_user_id and recent.created_at > pg_catalog.now() - interval '1 hour') >= 10 then
    raise exception using errcode = 'P0001', message = 'REPORT_RATE_LIMIT: Đã đạt giới hạn báo cáo trong giờ này';
  end if;

  v_ttl := case when p_incident_type in ('accident','road_closure') then interval '12 hours' else interval '4 hours' end;
  insert into public.traffic_reports (
    user_id, incident_type, severity, status, geom, note, gps_accuracy_m, heading_deg,
    image_path, created_at, expires_at, version
  ) values (
    v_user_id, p_incident_type, p_severity, 'active',
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
    nullif(pg_catalog.btrim(p_note), ''), p_gps_accuracy_m, p_heading_deg,
    p_image_path, pg_catalog.now(), pg_catalog.now() + v_ttl, 1
  ) returning * into v_report;

  return query select v_report.id, v_report.incident_type, v_report.severity,
    extensions.st_y(v_report.geom::extensions.geometry), extensions.st_x(v_report.geom::extensions.geometry),
    v_report.note, v_report.gps_accuracy_m, v_report.heading_deg, v_report.status,
    v_report.created_at, v_report.expires_at, v_report.version, v_report.image_path;
end;
$function$;
revoke all on function public.create_traffic_report(text,text,double precision,double precision,text,double precision,double precision,text) from public;
grant execute on function public.create_traffic_report(text,text,double precision,double precision,text,double precision,double precision,text) to authenticated;

drop function public.update_traffic_report_clearance(uuid,text);
create function public.update_traffic_report_clearance(p_report_id uuid, p_state text)
returns table (
  id uuid, incident_type text, severity text, lat double precision, lng double precision,
  note text, gps_accuracy_m double precision, heading_deg double precision,
  status text, created_at timestamptz, expires_at timestamptz, version integer, image_path text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_report public.traffic_reports%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_state is null or p_state not in ('clear','still_active') then
    raise exception using errcode = '22023', message = 'Invalid clearance state';
  end if;
  select report.* into v_report from public.traffic_reports as report where report.id = p_report_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Traffic report not found'; end if;
  if v_report.expires_at <= pg_catalog.now() or v_report.status = 'expired' then
    raise exception using errcode = 'P0001', message = 'REPORT_EXPIRED: Báo cáo này đã hết hạn';
  end if;
  if exists (
    select 1 from public.report_updates as update_row
    where update_row.report_id = p_report_id and update_row.user_id = v_user_id
      and update_row.created_at > pg_catalog.now() - interval '2 minutes'
  ) then
    raise exception using errcode = 'P0001', message = 'REPORT_UPDATE_COOLDOWN: Chờ trước khi xác minh lại báo cáo này';
  end if;

  update public.traffic_reports as report
  set status = case when p_state = 'clear' then 'cleared' else 'active' end,
      version = report.version + 1
  where report.id = p_report_id returning report.* into v_report;
  insert into public.report_updates (report_id, user_id, state) values (p_report_id, v_user_id, p_state);

  return query select v_report.id, v_report.incident_type, v_report.severity,
    extensions.st_y(v_report.geom::extensions.geometry), extensions.st_x(v_report.geom::extensions.geometry),
    v_report.note, v_report.gps_accuracy_m, v_report.heading_deg, v_report.status,
    v_report.created_at, v_report.expires_at, v_report.version, v_report.image_path;
end;
$function$;
revoke all on function public.update_traffic_report_clearance(uuid,text) from public;
grant execute on function public.update_traffic_report_clearance(uuid,text) to authenticated;

create or replace function public.broadcast_traffic_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_report public.traffic_reports%rowtype;
begin
  v_report := new;
  perform realtime.send(
    pg_catalog.jsonb_build_object(
      'id', v_report.id,
      'incidentType', v_report.incident_type,
      'severity', v_report.severity,
      'lat', extensions.st_y(v_report.geom::extensions.geometry),
      'lng', extensions.st_x(v_report.geom::extensions.geometry),
      'hasPhoto', v_report.image_path is not null,
      'status', v_report.status,
      'createdAt', v_report.created_at,
      'expiresAt', v_report.expires_at,
      'version', v_report.version
    ),
    'traffic_report_changed', 'traffic:reports', false
  );
  return new;
end;
$function$;
