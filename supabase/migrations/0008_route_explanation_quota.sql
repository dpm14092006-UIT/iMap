-- The existing minute quota remains independent for each feature.
alter table public.user_feature_usage_by_minute
  drop constraint if exists user_feature_usage_by_minute_feature_check;
alter table public.user_feature_usage_by_minute
  add constraint user_feature_usage_by_minute_feature_check
  check (feature in ('route_stops', 'voice', 'route_explanation'));

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
  if p_feature is null or p_feature not in ('route_stops', 'voice', 'route_explanation') then
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

