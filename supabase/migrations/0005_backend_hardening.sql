-- Backend hardening: serialize traffic-report quotas and bound paid image analysis.
begin;

create index if not exists idx_traffic_reports_user_created
  on public.traffic_reports (user_id, created_at desc);

create table if not exists public.traffic_image_usage_by_hour (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (user_id, period_start)
);
create index if not exists idx_traffic_image_usage_period
  on public.traffic_image_usage_by_hour (period_start);
alter table public.traffic_image_usage_by_hour enable row level security;
revoke all on public.traffic_image_usage_by_hour from public, anon, authenticated;

create or replace function public.consume_traffic_image_quota()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_period_start timestamptz := pg_catalog.date_trunc('hour', pg_catalog.now());
  v_request_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  insert into public.traffic_image_usage_by_hour as usage (user_id, period_start, request_count)
  values (v_user_id, v_period_start, 1)
  on conflict (user_id, period_start) do update
    set request_count = usage.request_count + 1
  returning request_count into v_request_count;

  if v_request_count > 10 then
    raise exception using errcode = 'P0001', message = 'TRAFFIC_IMAGE_RATE_LIMIT: Hourly traffic image quota reached';
  end if;
end;
$function$;
revoke all on function public.consume_traffic_image_quota() from public, anon;
grant execute on function public.consume_traffic_image_quota() to authenticated;

create table if not exists public.user_feature_usage_by_minute (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('route_stops', 'voice')),
  period_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (user_id, feature, period_start)
);
create index if not exists idx_user_feature_usage_period
  on public.user_feature_usage_by_minute (period_start);
alter table public.user_feature_usage_by_minute enable row level security;
revoke all on public.user_feature_usage_by_minute from public, anon, authenticated;

create or replace function public.consume_user_feature_quota(p_feature text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_period_start timestamptz := pg_catalog.date_trunc('minute', pg_catalog.now());
  v_request_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_feature is null or p_feature not in ('route_stops', 'voice') then
    raise exception using errcode = '22023', message = 'Unsupported feature quota';
  end if;

  insert into public.user_feature_usage_by_minute as usage (user_id, feature, period_start, request_count)
  values (v_user_id, p_feature, v_period_start, 1)
  on conflict (user_id, feature, period_start) do update
    set request_count = usage.request_count + 1
  returning request_count into v_request_count;

  if v_request_count > 5 then
    raise exception using errcode = 'P0001', message = 'FEATURE_RATE_LIMIT: Per-user feature quota reached';
  end if;
end;
$function$;
revoke all on function public.consume_user_feature_quota(text) from public, anon;
grant execute on function public.consume_user_feature_quota(text) to authenticated;

-- Recreate the report RPC so concurrent requests by one account cannot pass
-- the per-minute and per-hour checks before either insert becomes visible.
drop function if exists public.create_traffic_report(text,text,double precision,double precision,text,double precision,double precision);
drop function if exists public.create_traffic_report(text,text,double precision,double precision,text,double precision,double precision,text);
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

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));

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
revoke all on function public.create_traffic_report(text,text,double precision,double precision,text,double precision,double precision,text) from public, anon;
grant execute on function public.create_traffic_report(text,text,double precision,double precision,text,double precision,double precision,text) to authenticated;

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
  delete from public.traffic_image_usage_by_hour where period_start < pg_catalog.now() - interval '48 hours';
  delete from public.user_feature_usage_by_minute where period_start < pg_catalog.now() - interval '48 hours';
  return v_count;
end;
$function$;
revoke all on function public.expire_stale_traffic_reports() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
