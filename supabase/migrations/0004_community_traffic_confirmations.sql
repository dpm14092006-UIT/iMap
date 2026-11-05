-- Keep every traffic report, while adding a recent-nearby corroboration summary.
-- Until reports are map-matched to OSM/VietMap road segments, use a conservative
-- 75 m spatial neighborhood and the same incident type over the latest 30 min.

create index if not exists idx_traffic_reports_active_type_created
  on public.traffic_reports (incident_type, created_at desc)
  where status = 'active';

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
  status text, created_at timestamptz, expires_at timestamptz, version integer, image_path text,
  community_report_count integer, community_reporter_count integer, community_updated_at timestamptz
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
    report.created_at, report.expires_at, report.version, report.image_path,
    community.report_count, community.reporter_count, community.updated_at
  from public.traffic_reports as report
  cross join lateral (
    select
      pg_catalog.count(*)::integer as report_count,
      pg_catalog.count(distinct nearby.user_id)::integer as reporter_count,
      pg_catalog.max(nearby.created_at) as updated_at
    from public.traffic_reports as nearby
    where nearby.incident_type = report.incident_type
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
