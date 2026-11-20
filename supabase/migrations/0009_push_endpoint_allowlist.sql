-- Chống SSRF qua Web Push: chỉ nhận endpoint của dịch vụ push thật (HTTPS, cổng 443).
-- Trước đây save_push_subscription chỉ kiểm tra tiền tố https:// nên một tài khoản có thể lưu URL tự chọn
-- (IP nội bộ, metadata cloud, host bất kỳ) và khiến server gửi request tới đó khi có sự cố trên tuyến.
-- Giữ đồng bộ với apps/api/src/modules/traffic/domain/pushEndpointPolicy.ts (API kiểm tra lại trước khi gửi).

create or replace function public.is_allowed_push_endpoint(p_endpoint text)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select p_endpoint is not null
    and length(p_endpoint) <= 2048
    and p_endpoint ~* '^https://(fcm\.googleapis\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.push\.services\.mozilla\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.push\.apple\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.notify\.windows\.com)(:443)?/';
$function$;
revoke all on function public.is_allowed_push_endpoint(text) from public;
grant execute on function public.is_allowed_push_endpoint(text) to authenticated, service_role;

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
  if not public.is_allowed_push_endpoint(p_endpoint) then
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

-- Dọn đăng ký đã lưu trước khi có chính sách (route_watches tự xóa theo on delete cascade).
delete from public.push_subscriptions where not public.is_allowed_push_endpoint(endpoint);

notify pgrst, 'reload schema';
