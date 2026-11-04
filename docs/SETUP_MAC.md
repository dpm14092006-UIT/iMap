# Setup macOS (Apple Silicon)

1. Kiểm tra `node -v` (>= 20.19), `npm -v`.
2. `cd RouteTwin_OOP_Starter && ./run.sh`
3. Mở `http://localhost:5173`.
4. Kiểm tra backend `curl http://localhost:4000/api/health`.
5. Tạo `apps/api/.env` và `apps/web/.env` từ các file `.env.example`.
6. Tạo project Supabase; trong SQL Editor chạy lần lượt `supabase/migrations/0001_initial.sql` rồi `0002_n2_traffic_auth_ai.sql`. Bật Auth Email, đặt Site URL thành `http://localhost:5173` và thêm `http://localhost:5173/**` cùng `http://127.0.0.1:5173/**` vào Auth URL Configuration. Đặt URL/publishable key vào cả hai `.env`; chỉ đặt `SUPABASE_SERVICE_ROLE_KEY` trong `apps/api/.env`.
7. Đặt `GEMINI_API_KEY` trong `apps/api/.env` để bật phân tích ảnh; không đặt khóa Gemini trong `VITE_*`.
8. Bật `pg_cron` trong Supabase rồi chạy `supabase/ops/traffic-expiry-cron.sql` để chuyển các báo cáo quá hạn thành `expired` và broadcast cập nhật.

Lỗi thường gặp: port 4000 hoặc 5173 đã sử dụng → tắt tiến trình cũ / đổi `API_PORT` và proxy tương ứng. `npm install` cần mạng lần đầu. Khi thiếu Supabase/Gemini config, API health vẫn chạy nhưng tính năng tương ứng trả lỗi cấu hình; không có dữ liệu giả thay thế. Không copy secret ra frontend.
