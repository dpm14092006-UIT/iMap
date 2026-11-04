# Supabase – owner N2

Áp dụng `migrations/0001_initial.sql`, sau đó `migrations/0002_n2_traffic_auth_ai.sql` trong SQL Editor của Supabase (hoặc Supabase CLI đã link đúng project). Migration thứ hai thêm RLS, RPC PostGIS, Auth profile trigger, báo cáo cộng đồng, Gemini result table và private Storage bucket.

Sau đó bật `pg_cron` trong Dashboard và chạy `ops/traffic-expiry-cron.sql` một lần. `GET /api/traffic-reports` vẫn ẩn ngay các báo cáo quá hạn nếu Cron chưa bật; Cron cập nhật trạng thái DB và phát Realtime event đúng lúc.

Không dùng key `service_role` trong web. Chỉ API dùng key này cho thao tác lưu kết quả AI sau khi đã xác minh access token; mọi quyền đọc Storage/lịch sử của người dùng được giới hạn theo RLS.
