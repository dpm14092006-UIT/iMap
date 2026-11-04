# API contracts

Các schema/DTO được định nghĩa một lần ở `packages/shared/src`. Frontend/backend cùng import.

- JSON position: `{ "lat": 10.77, "lng": 106.69 }`; GeoJSON `[106.69, 10.77]`.
- Server trả `distanceMeters`, `durationSeconds`; frontend mới chuyển đơn vị.
- Success: `{ "data": T }`. Error: `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`.
- Kết quả định tuyến có `source: 'vietmap'`, `coordinates` theo GeoJSON `[lng,lat]` và danh sách hướng dẫn rẽ. Không có tuyến mẫu dự phòng.
- `GET /api/traffic-reports` nhận `minLat`, `minLng`, `maxLat`, `maxLng`; trả tối đa 200 báo cáo còn hạn trong bounding box. `GET /api/traffic-reports/geojson` trả cùng dữ liệu thành GeoJSON `[lng,lat]`.
- Tạo báo cáo và xác minh báo cáo yêu cầu `Authorization: Bearer <Supabase access token>`.
- `POST /api/traffic-reports` nhận JSON `TrafficReportInput`. `POST /api/traffic-reports/:id/clearance` nhận `{ "state": "clear" | "still_active" }`.
- Ảnh báo cáo được tải lên private bucket `traffic-images` bằng phiên người dùng với MIME JPG/PNG/WebP, tối đa 5 MB. `POST /api/traffic-reports` nhận `imagePath` tuỳ chọn sau khi người dùng tải ảnh lên; RPC xác minh đường dẫn thuộc tài khoản gửi báo cáo.
- Snapshot báo cáo trả `imagePath` để ứng dụng có thể tạo signed URL. RLS cho phép chủ ảnh đọc ảnh của họ và người dùng đã đăng nhập đọc ảnh của báo cáo còn hiệu lực.
- `/api/routes/calculate` nhận danh sách điểm theo thứ tự và loại xe `car` hoặc `motorcycle`; N1 endpoints chưa triển khai vẫn trả HTTP 501.
