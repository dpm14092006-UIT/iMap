# Supabase – owner N2

Liên kết project bằng Supabase CLI để giữ migration history đồng bộ:

```sh
supabase login
supabase link --project-ref <project-ref>
supabase db push --linked
```

Lệnh cuối áp dụng lần lượt `migrations/0001_initial.sql`, `migrations/0002_n2_traffic_auth_ai.sql`, `migrations/0003_traffic_report_photos.sql` và `migrations/0004_community_traffic_confirmations.sql`. Migration thứ hai thiết lập Auth/RLS, RPC PostGIS, báo cáo cộng đồng và private Storage bucket; migration thứ ba gỡ metadata/quota AI cũ và gắn ảnh minh chứng vào traffic reports; migration thứ tư tổng hợp các xác nhận gần đây mà vẫn giữ từng báo cáo gốc. Có thể chạy SQL thủ công theo đúng thứ tự trong Dashboard, nhưng cần đánh dấu migration đã áp dụng trước khi quay lại dùng CLI.

Sau đó bật `pg_cron` trong Dashboard và chạy `ops/traffic-expiry-cron.sql` một lần. `GET /api/traffic-reports` vẫn ẩn ngay các báo cáo quá hạn nếu Cron chưa bật; Cron cập nhật trạng thái DB và phát Realtime event đúng lúc.

Không dùng secret key trong web. API nhận publishable key cùng access token của người dùng; Storage upload dùng phiên đăng nhập ở web và được giới hạn bằng RLS.
