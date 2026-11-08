-- FIXED-0002-RPC-RETURN-TYPE-v2
-- Run this ENTIRE file after 0001, then run 0003 and 0004 in order.
begin;

-- N2: Auth/RLS, bounded PostGIS traffic queries, community updates, AI audit and private image storage.

alter table public.traffic_reports
  add column if not exists note text,
  add column if not exists gps_accuracy_m double precision,
  add column if not exists heading_deg double precision,
  add column if not exists version integer not null default 1;

update public.traffic_reports
set expires_at = created_at + interval '4 hours'
where expires_at is null;

update public.traffic_reports
set status = 'expired'
where status = 'active' and expires_at <= now();

alter table public.traffic_reports alter column expires_at set not null;
alter table public.traffic_reports drop constraint if exists traffic_reports_incident_type_check;
alter table public.traffic_reports add constraint traffic_reports_incident_type_check
  check (incident_type in ('traffic_jam','accident','construction','flood','road_closure','obstacle'));
alter table public.traffic_reports drop constraint if exists traffic_reports_note_length_check;
alter table public.traffic_reports add constraint traffic_reports_note_length_check
  check (note is null or char_length(note) <= 300);
alter table public.traffic_reports drop constraint if exists traffic_reports_gps_accuracy_check;
alter table public.traffic_reports add constraint traffic_reports_gps_accuracy_check
  check (gps_accuracy_m is null or gps_accuracy_m between 0 and 100000);
alter table public.traffic_reports drop constraint if exists traffic_reports_heading_check;
alter table public.traffic_reports add constraint traffic_reports_heading_check
  check (heading_deg is null or heading_deg >= 0 and heading_deg < 360);
alter table public.traffic_reports drop constraint if exists traffic_reports_version_check;
alter table public.traffic_reports add constraint traffic_reports_version_check check (version > 0);
create index if not exists idx_traffic_reports_active_expiry
  on public.traffic_reports(status, expires_at desc);

create table if not exists public.report_updates (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.traffic_reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null check (state in ('clear','still_active')),
  created_at timestamptz not null default now()
);
create index if not exists idx_report_updates_cooldown
  on public.report_updates(report_id, user_id, created_at desc);

create table if not exists public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task text not null check (task in ('traffic_analysis','sign_recognition')),
  result jsonb not null,
  model text not null,
  image_path text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_analyses_user_created
  on public.ai_analyses(user_id, created_at desc);
alter table public.ai_analyses drop constraint if exists ai_analyses_image_owner_path_check;
alter table public.ai_analyses add constraint ai_analyses_image_owner_path_check
  check (pg_catalog.split_part(image_path, '/', 1) = user_id::text);

create table if not exists public.ai_usage_by_hour (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (user_id, period_start)
);

-- Create a profile for every new Supabase Auth user.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.traffic_reports enable row level security;
alter table public.saved_routes enable row level security;
alter table public.report_updates enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.ai_usage_by_hour enable row level security;

drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_self on public.profiles
  for select to authenticated using (id = (select auth.uid()));
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists saved_routes_read_self on public.saved_routes;
create policy saved_routes_read_self on public.saved_routes
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists saved_routes_create_self on public.saved_routes;
create policy saved_routes_create_self on public.saved_routes
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists saved_routes_update_self on public.saved_routes;
create policy saved_routes_update_self on public.saved_routes
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists saved_routes_delete_self on public.saved_routes;
create policy saved_routes_delete_self on public.saved_routes
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists ai_analyses_read_self on public.ai_analyses;
create policy ai_analyses_read_self on public.ai_analyses
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.traffic_reports from anon, authenticated;
revoke all on public.report_updates from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.saved_routes from anon, authenticated;
revoke all on public.ai_analyses from anon, authenticated;
revoke all on public.ai_usage_by_hour from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.saved_routes to authenticated;
grant select on public.ai_analyses to authenticated;

drop function if exists public.get_traffic_reports_bbox(double precision,double precision,double precision,double precision);
create function public.get_traffic_reports_bbox(
  p_min_lat double precision,
  p_min_lng double precision,
  p_max_lat double precision,
  p_max_lng double precision
)
returns table (
  id uuid, incident_type text, severity text, lat double precision, lng double precision,
  note text, gps_accuracy_m double precision, heading_deg double precision,
  status text, created_at timestamptz, expires_at timestamptz, version integer
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
  select r.id, r.incident_type, r.severity,
    extensions.st_y(r.geom::extensions.geometry),
    extensions.st_x(r.geom::extensions.geometry),
    r.note, r.gps_accuracy_m, r.heading_deg, 'active'::text,
    r.created_at, r.expires_at, r.version
  from public.traffic_reports as r
  where r.status = 'active'
    and r.expires_at > pg_catalog.now()
    and extensions.st_intersects(
      r.geom,
      extensions.st_makeenvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::extensions.geography
    )
  order by r.created_at desc
  limit 200;
end;
$function$;

drop function if exists public.create_traffic_report(text,text,double precision,double precision,text,double precision,double precision);
drop function if exists public.create_traffic_report(text,text,double precision,double precision,text,double precision,double precision,text);
create function public.create_traffic_report(
  p_incident_type text,
  p_severity text,
  p_lat double precision,
  p_lng double precision,
  p_note text default null,
  p_gps_accuracy_m double precision default null,
  p_heading_deg double precision default null
)
returns table (
  id uuid, incident_type text, severity text, lat double precision, lng double precision,
  note text, gps_accuracy_m double precision, heading_deg double precision,
  status text, created_at timestamptz, expires_at timestamptz, version integer
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
    or (p_heading_deg is not null and (p_heading_deg < 0 or p_heading_deg >= 360)) then
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
    user_id, incident_type, severity, status, geom, note, gps_accuracy_m, heading_deg, created_at, expires_at, version
  ) values (
    v_user_id, p_incident_type, p_severity, 'active',
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
    nullif(pg_catalog.btrim(p_note), ''), p_gps_accuracy_m, p_heading_deg, pg_catalog.now(), pg_catalog.now() + v_ttl, 1
  ) returning * into v_report;

  return query select v_report.id, v_report.incident_type, v_report.severity,
    extensions.st_y(v_report.geom::extensions.geometry), extensions.st_x(v_report.geom::extensions.geometry),
    v_report.note, v_report.gps_accuracy_m, v_report.heading_deg, v_report.status,
    v_report.created_at, v_report.expires_at, v_report.version;
end;
$function$;

drop function if exists public.update_traffic_report_clearance(uuid,text);
create function public.update_traffic_report_clearance(p_report_id uuid, p_state text)
returns table (
  id uuid, incident_type text, severity text, lat double precision, lng double precision,
  note text, gps_accuracy_m double precision, heading_deg double precision,
  status text, created_at timestamptz, expires_at timestamptz, version integer
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
  select r.* into v_report from public.traffic_reports as r where r.id = p_report_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Traffic report not found'; end if;
  if v_report.expires_at <= pg_catalog.now() or v_report.status = 'expired' then
    raise exception using errcode = 'P0001', message = 'REPORT_EXPIRED: Báo cáo này đã hết hạn';
  end if;
  if exists (
    select 1 from public.report_updates as u
    where u.report_id = p_report_id and u.user_id = v_user_id
      and u.created_at > pg_catalog.now() - interval '2 minutes'
  ) then
    raise exception using errcode = 'P0001', message = 'REPORT_UPDATE_COOLDOWN: Chờ trước khi xác minh lại báo cáo này';
  end if;

  update public.traffic_reports as r
  set status = case when p_state = 'clear' then 'cleared' else 'active' end,
      version = r.version + 1
  where r.id = p_report_id returning r.* into v_report;
  insert into public.report_updates (report_id, user_id, state) values (p_report_id, v_user_id, p_state);

  return query select v_report.id, v_report.incident_type, v_report.severity,
    extensions.st_y(v_report.geom::extensions.geometry), extensions.st_x(v_report.geom::extensions.geometry),
    v_report.note, v_report.gps_accuracy_m, v_report.heading_deg, v_report.status,
    v_report.created_at, v_report.expires_at, v_report.version;
end;
$function$;

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
  delete from public.ai_usage_by_hour where period_start < pg_catalog.now() - interval '48 hours';
  return v_count;
end;
$function$;

create or replace function public.consume_ai_analysis_quota()
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
  insert into public.ai_usage_by_hour as usage (user_id, period_start, request_count)
  values (v_user_id, v_period_start, 1)
  on conflict (user_id, period_start) do update
    set request_count = usage.request_count + 1
  returning request_count into v_request_count;
  if v_request_count > 10 then
    raise exception using errcode = 'P0001', message = 'AI_RATE_LIMIT: Hourly AI request quota reached';
  end if;
end;
$function$;

revoke all on function public.get_traffic_reports_bbox(double precision,double precision,double precision,double precision) from public;
revoke all on function public.create_traffic_report(text,text,double precision,double precision,text,double precision,double precision) from public;
revoke all on function public.update_traffic_report_clearance(uuid,text) from public;
revoke all on function public.expire_stale_traffic_reports() from public;
revoke all on function public.consume_ai_analysis_quota() from public;
grant execute on function public.get_traffic_reports_bbox(double precision,double precision,double precision,double precision) to anon, authenticated;
grant execute on function public.create_traffic_report(text,text,double precision,double precision,text,double precision,double precision) to authenticated;
grant execute on function public.update_traffic_report_clearance(uuid,text) to authenticated;
grant execute on function public.consume_ai_analysis_quota() to authenticated;

-- Public, sanitized broadcasts carry only the map fields; clients fetch a bounded snapshot on reconnect.
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

drop trigger if exists traffic_report_broadcast on public.traffic_reports;
create trigger traffic_report_broadcast
  after insert or update of status, expires_at, version on public.traffic_reports
  for each row execute function public.broadcast_traffic_report();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('traffic-images', 'traffic-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists traffic_images_upload_own on storage.objects;
create policy traffic_images_upload_own on storage.objects
  for insert to authenticated with check (
    bucket_id = 'traffic-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists traffic_images_read_own on storage.objects;
create policy traffic_images_read_own on storage.objects
  for select to authenticated using (
    bucket_id = 'traffic-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists traffic_images_delete_own on storage.objects;
create policy traffic_images_delete_own on storage.objects
  for delete to authenticated using (
    bucket_id = 'traffic-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

notify pgrst, 'reload schema';
commit;
