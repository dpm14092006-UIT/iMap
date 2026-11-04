# Implementation backlog

Các đầu việc dưới đây chưa được triển khai. Chúng được giữ tập trung ở tài liệu này để thư mục source chỉ chứa mã đang dùng.

## N1 — Navigation & optimization

### Places API adapter

- Viết `VietmapPlacesProvider implements PlaceSearchProvider`.
- Hỗ trợ gợi ý có debounce, hủy request cũ và giới hạn 5–8 kết quả.
- Lấy Place Details sau khi người dùng chọn địa điểm; không suy tọa độ bằng geocoding tên tùy tiện.
- Tuân thủ điều khoản cache và bảo vệ khóa API phía máy chủ.

### A* solver

- Viết `AStarSolver implements ShortestPathStrategy`; chỉ tạo interface chiến lược nếu có thêm thuật toán cần dùng chung.
- Heuristic khoảng cách đường chim bay không được vượt chi phí đường thực tế. Nếu tối ưu thời gian, dùng giới hạn tốc độ cao nhất hợp lệ.
- Dùng min-heap, `gScore`, `fScore`, parent, visited và khôi phục đường đi.
- So sánh chi phí với Dijkstra trên cùng đồ thị và phương tiện. Chỉ dùng số node đã duyệt trong benchmark/test.

### Vietmap Matrix/TSP và 2-opt

- Viết `VietmapMatrixProvider implements MatrixProvider` để lấy ma trận theo phương tiện và loại chi phí.
- Kiểm tra input, quota, retry có giới hạn và cache theo điều khoản.
- Dùng VietMap TSP v4 để đối chiếu; không giả định Route v4 tự đổi thứ tự điểm dừng.
- Với ma trận có hướng, tính lại toàn bộ chi phí ứng viên 2-opt hoặc dùng delta formula hợp lệ cho ATSP.
- Giữ điểm cuối cố định hoặc quay về điểm đầu khi tùy chọn tương ứng được bật.
- Dựng hình học từng chặng bằng Route API, không nối thẳng các điểm.

## N2 — Traffic, AI & data

### Đã triển khai trong source

- Auth UI/context và API JWT verification; writes dùng access token người dùng, không dùng `service_role`.
- Traffic repository dùng RPC PostGIS có bounding box, giới hạn 200 kết quả, RLS, chống spam, versioning, xác minh và hết hạn.
- GeoJSON `FeatureCollection`, Broadcast từ trigger Postgres và snapshot khi kết nối/reconnect.
- Hai Gemini Vision use case, schema Zod riêng, MIME/signature + giới hạn 5 MB, giới hạn lượt gọi; ảnh private theo user và kết quả lưu trong `ai_analyses`.
- Traffic panel gửi/đồng bộ/xác minh; AI panel tải ảnh và hiển thị kết quả. Giao diện vẫn cần credentials để chạy live.

### Còn cần cấu hình/nghiệm thu trên Supabase

- Điền URL/keys, áp dụng migration và bật job expiry. Chưa chạy được do project credentials chưa có trong workspace.
- Kiểm tra RLS, Auth confirmation email, Realtime và Storage trên project thật.
- Đánh giá precision/recall/F1 bằng bộ ảnh giao thông Việt Nam có nhãn chuẩn; chưa có bộ dữ liệu chuẩn đi kèm repo.

### TrafficMapLayer (đã có API/Realtime; adapter trực tiếp vào Leaflet còn thuộc N1)

- N2 cung cấp GeoJSON `FeatureCollection` từ `traffic_reports`, có marker theo loại và mức độ.
- N1 hiển thị layer qua abstraction của `MapView`, không để module traffic phụ thuộc nội bộ Map SDK.
- Bổ sung Realtime Broadcast và lấy snapshot khi kết nối lại.

### Supabase traffic repository (đã triển khai)

- Viết `SupabaseTrafficReportRepository implements TrafficReportRepository`.
- Lưu `geom geography(Point,4326)` trong PostGIS; thứ tự GeoJSON là `[lng,lat]`.
- Truy vấn theo bounding box/geo-cell, dùng RLS/JWT và không tải toàn bộ bản ghi.
- Phát Realtime Broadcast sau khi tạo hoặc xác nhận đã thông thoáng; xử lý snapshot khi reconnect.
- Giới hạn số cảnh báo, tự hết hạn, chống spam và kiểm tra quyền sở hữu.

### Gemini Vision adapter (đã triển khai; chưa đánh giá tập dữ liệu)

- Dùng một service cho hai tác vụ độc lập với hai Zod output schemas.
- Kiểm tra MIME/kích thước file; gọi Gemini phía backend; parse JSON và trả `unknown` khi ảnh không rõ.
- Cho phép tạo báo cáo giao thông trước khi AI trả kết quả; ảnh tĩnh không đủ để khẳng định có kẹt xe.
- Nhận diện biển báo chỉ là dữ liệu tham khảo, không tự thêm quy tắc cấm đường.
- Đánh giá bằng ảnh Việt Nam có bộ đối chiếu; đo precision, recall và F1.
