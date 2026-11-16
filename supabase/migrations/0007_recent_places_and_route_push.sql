-- 0007: lịch sử 10 điểm đi / 10 điểm đến theo tài khoản, Web Push cho xe đang đi trên tuyến có sự cố,
-- và sửa số người báo cáo hiển thị "0 người" khi báo cáo không còn user_id.
begin;

-- ---------------------------------------------------------------------------
-- 1. Số người gửi: báo cáo không có user_id (tài khoản đã xóa) vẫn tính là một người riêng.
-- ---------------------------------------------------------------------------
drop function if exists public.get_traffic_reports_bbox(double precision,double precision,double precision,double precision);
create function public.get_traffic_reports_bbox(
  p_min_lat double precision,
  p_min_lng double precision,
  p_max_lat double precision,
  p_max_lng double precision
)
returns table (
  id uuid, incident_type text, severity text, vehicle_scope text,
  lat double precision, lng double precision, note text,
  gps_accuracy_m double precision, heading_deg double precision,
  status text, created_at timestamptz, expires_at timestamptz, version integer,
  image_path text, community_report_count integer, community_reporter_count integer,
  community_updated_at timestamptz
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
  select report.id, report.incident_type, report.severity, report.vehicle_scope,
    extensions.st_y(report.geom::extensions.geometry),
    extensions.st_x(report.geom::extensions.geometry),
    report.note, report.gps_accuracy_m, report.heading_deg, 'active'::text,
    report.created_at, report.expires_at, report.version, report.image_path,
    community.report_count, community.reporter_count, community.updated_at
  from public.traffic_reports as report
  cross join lateral (
    select
      pg_catalog.count(*)::integer as report_count,
      pg_catalog.count(distinct coalesce(nearby.user_id::text, nearby.id::text))::integer as reporter_count,
      pg_catalog.max(nearby.created_at) as updated_at
    from public.traffic_reports as nearby
    where nearby.incident_type = report.incident_type
      and nearby.vehicle_scope = report.vehicle_scope
      and nearby.status = 'active'
      and nearby.expires_at > pg_catalog.now()
      and nearby.created_at > pg_catalog.now() - interval '30 minutes'
      and extensions.st_dwithin(nearby.geom, report.geom, 75)
  ) as community
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

-- ---------------------------------------------------------------------------
-- 2. Lịch sử điểm đi / điểm đến: mỗi tài khoản giữ 10 điểm gần nhất cho từng loại.
-- ---------------------------------------------------------------------------
create table if not exists public.recent_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('origin', 'destination')),
  place_key text not null check (char_length(place_key) between 1 and 200),
  name text not null check (char_length(name) between 1 and 200),
  address text not null default '' check (char_length(address) <= 300),
  category text not null default '' check (char_length(category) <= 80),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  source text not null default 'map',
  used_at timestamptz not null default now(),
  unique (user_id, kind, place_key)
);
create index if not exists idx_recent_places_user_kind_used
  on public.recent_places (user_id, kind, used_at desc);
alter table public.recent_places enable row level security;

drop policy if exists recent_places_read_self on public.recent_places;
create policy recent_places_read_self on public.recent_places
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists recent_places_delete_self on public.recent_places;
create policy recent_places_delete_self on public.recent_places
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, delete on public.recent_places to authenticated;

create or replace function public.record_recent_place(
  p_kind text,
  p_place_key text,
  p_name text,
  p_address text,
  p_category text,
  p_lat double precision,
  p_lng double precision,
  p_source text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  insert into public.recent_places (user_id, kind, place_key, name, address, category, lat, lng, source, used_at)
  values (v_user, p_kind, p_place_key, p_name, coalesce(p_address, ''), coalesce(p_category, ''),
    p_lat, p_lng, coalesce(p_source, 'map'), pg_catalog.now())
  on conflict (user_id, kind, place_key) do update
    set name = excluded.name, address = excluded.address, category = excluded.category,
      lat = excluded.lat, lng = excluded.lng, source = excluded.source, used_at = excluded.used_at;

  delete from public.recent_places
  where user_id = v_user and kind = p_kind
    and id not in (
      select keep.id from public.recent_places as keep
      where keep.user_id = v_user and keep.kind = p_kind
      order by keep.used_at desc
      limit 10
    );
end;
$function$;
revoke all on function public.record_recent_place(text,text,text,text,text,double precision,double precision,text) from public;
grant execute on function public.record_recent_place(text,text,text,text,text,double precision,double precision,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Web Push: đăng ký thông báo của từng trình duyệt và tuyến đang đi của trình duyệt đó.
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  endpoint text primary key check (char_length(endpoint) between 10 and 1000),
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null check (char_length(p256dh) between 10 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_read_self on public.push_subscriptions;
create policy push_subscriptions_read_self on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists push_subscriptions_delete_self on public.push_subscriptions;
create policy push_subscriptions_delete_self on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, delete on public.push_subscriptions to authenticated;

create table if not exists public.route_watches (
  endpoint text primary key references public.push_subscriptions(endpoint) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle text not null check (vehicle in ('car', 'motorcycle')),
  path extensions.geography(LineString, 4326) not null,
  location extensions.geography(Point, 4326),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists idx_route_watches_path on public.route_watches using gist (path);
create index if not exists idx_route_watches_expires on public.route_watches (expires_at);
alter table public.route_watches enable row level security;
drop policy if exists route_watches_read_self on public.route_watches;
create policy route_watches_read_self on public.route_watches
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists route_watches_delete_self on public.route_watches;
create policy route_watches_delete_self on public.route_watches
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, delete on public.route_watches to authenticated;

-- Lưu (hoặc chuyển chủ) đăng ký push của trình duyệt cho tài khoản đang đăng nhập.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_endpoint !~ '^https://' then
    raise exception using errcode = '22023', message = 'Invalid push endpoint';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, v_user, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
      updated_at = pg_catalog.now();
  -- Trình duyệt đổi chủ thì tuyến đang theo dõi của chủ cũ không còn giá trị.
  delete from public.route_watches where endpoint = p_endpoint and user_id <> v_user;
end;
$function$;
revoke all on function public.save_push_subscription(text,text,text) from public;
grant execute on function public.save_push_subscription(text,text,text) to authenticated;

-- Cập nhật tuyến đang đi (tối đa 500 điểm [lat,lng]) và vị trí hiện tại; hết hạn sau 20 phút nếu không làm mới.
create or replace function public.upsert_route_watch(
  p_endpoint text,
  p_vehicle text,
  p_path jsonb,
  p_lat double precision default null,
  p_lng double precision default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_line extensions.geometry;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if not exists (
    select 1 from public.push_subscriptions where endpoint = p_endpoint and user_id = v_user
  ) then
    raise exception using errcode = '42501', message = 'PUSH_SUBSCRIPTION_NOT_FOUND';
  end if;
  if p_vehicle not in ('car', 'motorcycle') or pg_catalog.jsonb_typeof(p_path) <> 'array'
    or pg_catalog.jsonb_array_length(p_path) < 2 or pg_catalog.jsonb_array_length(p_path) > 500 then
    raise exception using errcode = '22023', message = 'Invalid route watch';
  end if;

  select extensions.st_setsrid(
    extensions.st_makeline(
      array_agg(
        extensions.st_makepoint((point->>1)::double precision, (point->>0)::double precision)
        order by ordinal
      )
    ),
    4326
  )
  into v_line
  from pg_catalog.jsonb_array_elements(p_path) with ordinality as item(point, ordinal);

  insert into public.route_watches (endpoint, user_id, vehicle, path, location, updated_at, expires_at)
  values (
    p_endpoint, v_user, p_vehicle, v_line::extensions.geography,
    case when p_lat is null or p_lng is null then null
      else extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography end,
    pg_catalog.now(), pg_catalog.now() + interval '20 minutes'
  )
  on conflict (endpoint) do update
    set user_id = excluded.user_id, vehicle = excluded.vehicle, path = excluded.path,
      location = excluded.location, updated_at = excluded.updated_at, expires_at = excluded.expires_at;

  delete from public.route_watches where expires_at < pg_catalog.now() - interval '1 hour';
end;
$function$;
revoke all on function public.upsert_route_watch(text,text,jsonb,double precision,double precision) from public;
grant execute on function public.upsert_route_watch(text,text,jsonb,double precision,double precision) to authenticated;

-- Chỉ API (khóa service_role) gọi được: các trình duyệt có tuyến còn hiệu lực đi qua sự cố,
-- đúng loại xe, chưa đi qua điểm sự cố, trừ chính người báo cáo. Kèm số liệu cộng đồng 30 phút / 75 m.
create or replace function public.find_route_watchers(p_report_id uuid, p_corridor_m double precision default 150)
returns table (
  endpoint text, p256dh text, auth text,
  community_report_count integer, community_reporter_count integer, community_updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  with report as (
    select r.* from public.traffic_reports as r
    where r.id = p_report_id and r.status = 'active' and r.expires_at > pg_catalog.now()
  ),
  community as (
    select
      pg_catalog.count(*)::integer as report_count,
      pg_catalog.count(distinct coalesce(nearby.user_id::text, nearby.id::text))::integer as reporter_count,
      pg_catalog.max(nearby.created_at) as updated_at
    from public.traffic_reports as nearby, report
    where nearby.incident_type = report.incident_type
      and nearby.vehicle_scope = report.vehicle_scope
      and nearby.status = 'active'
      and nearby.expires_at > pg_catalog.now()
      and nearby.created_at > pg_catalog.now() - interval '30 minutes'
      and extensions.st_dwithin(nearby.geom, report.geom, 75)
  )
  select subscription.endpoint, subscription.p256dh, subscription.auth,
    community.report_count, community.reporter_count, community.updated_at
  from report
  cross join community
  join public.route_watches as watch
    on watch.expires_at > pg_catalog.now()
    and (report.vehicle_scope = 'both' or report.vehicle_scope = watch.vehicle)
    and (report.user_id is null or watch.user_id <> report.user_id)
    and extensions.st_dwithin(watch.path, report.geom, least(greatest(p_corridor_m, 30), 500))
    and (
      watch.location is null
      or extensions.st_linelocatepoint(watch.path::extensions.geometry, report.geom::extensions.geometry)
        >= extensions.st_linelocatepoint(watch.path::extensions.geometry, watch.location::extensions.geometry) - 0.002
    )
  join public.push_subscriptions as subscription on subscription.endpoint = watch.endpoint
  limit 2000;
$function$;
revoke all on function public.find_route_watchers(uuid, double precision) from public, anon, authenticated;
grant execute on function public.find_route_watchers(uuid, double precision) to service_role;

-- API xóa đăng ký đã hết hạn (push service trả 404/410).
create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $function$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$function$;
revoke all on function public.delete_push_subscription(text) from public, anon, authenticated;
grant execute on function public.delete_push_subscription(text) to service_role;

notify pgrst, 'reload schema';
commit;
