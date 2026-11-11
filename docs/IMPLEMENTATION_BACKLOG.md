# Trạng thái triển khai

Tài liệu này phản ánh source hiện tại; hạng mục chưa có mã được ghi là còn lại, không mô tả như tính năng đã chạy.

## N1 — Navigation & optimization

### Đã có

- Tìm địa điểm qua Photon/OpenStreetMap.
- Tính tuyến ô tô/xe máy qua VietMap Route API v4; hình học và hướng dẫn rẽ lấy từ API.
- Dijkstra trên graph và strategy Nearest Neighbor/2-opt có mã/kiểm thử riêng; chưa được nối thành endpoint tối ưu.
- Giao diện nhiều điểm gọi VietMap theo thứ tự người dùng sắp xếp, chưa tự tối ưu thứ tự.

### Còn lại

- Nhập graph đường OSM đủ tin cậy, bổ sung A* và so sánh kết quả với Dijkstra.
- Tích hợp VietMap Matrix/TSP và nối strategy vào endpoint tối ưu thứ tự nhiều điểm.
- API lưu và tải hành trình; hiện giao diện chỉ lưu trên localStorage.

## N2 — Traffic & data

### Đã có trong source

- Supabase Auth UI, kiểm tra access token ở API; các thao tác ghi dùng token người dùng.
- Báo cáo PostGIS theo bounding box, GeoJSON, giới hạn truy vấn, rate limit, xác nhận tình trạng và hết hạn.
- Realtime Broadcast cùng snapshot khi kết nối lại; ảnh báo cáo lưu trong bucket riêng tư.
- Gợi ý loại/mức độ/ghi chú sự cố từ ảnh và đọc biển báo ngay trong form báo cáo. Gemini mặc định tắt; người dùng xem lại và tự gửi.
- Tổng hợp báo cáo cùng loại trong bán kính 75 m và 30 phút; hiển thị số báo cáo, số người gửi riêng biệt và lần cập nhật. Không xóa/gộp báo cáo gốc. Đây chưa phải map-matching cùng một đoạn đường.

### Cần nghiệm thu trên Supabase

- Áp dụng đủ migration `0001`–`0005`, xác minh Auth/RLS, Realtime và Storage trên project thật.
- Bật `pg_cron` và áp dụng `supabase/ops/traffic-expiry-cron.sql`.
- Kiểm tra luồng upload/đọc ảnh trên thiết bị di động và quyền truy cập bằng nhiều tài khoản.
- Chỉ bật Gemini sau khi cấu hình key và rà soát điều khoản/phạm vi người dùng; xem `docs/AI_APPLICATIONS.md`.
