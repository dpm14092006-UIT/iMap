# API contracts

Các schema/DTO được định nghĩa một lần ở `packages/shared/src`. Frontend/backend cùng import.

- JSON position: `{ "lat": 10.77, "lng": 106.69 }`; GeoJSON `[106.69, 10.77]`.
- Server trả `distanceMeters`, `durationSeconds`; frontend mới chuyển đơn vị.
- Success: `{ "data": T }`. Error: `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`.
- Kết quả định tuyến có `source: 'vietmap'`, `coordinates` theo GeoJSON `[lng,lat]` và danh sách hướng dẫn rẽ. Không có tuyến mẫu dự phòng.
- `GET /api/traffic-reports` nhận `minLat`, `minLng`, `maxLat`, `maxLng`; trả tối đa 200 báo cáo còn hạn trong bounding box. `GET /api/traffic-reports/geojson` trả cùng dữ liệu thành GeoJSON `[lng,lat]`.
- Tạo báo cáo, xác minh báo cáo và hai endpoint AI yêu cầu `Authorization: Bearer <Supabase access token>`.
- `POST /api/traffic-reports` nhận JSON `TrafficReportInput`. `POST /api/traffic-reports/:id/clearance` nhận `{ "state": "clear" | "still_active" }`.
- `POST /api/ai/analyze-traffic` và `/api/ai/recognize-sign` nhận raw image body với `Content-Type: image/jpeg|image/png|image/webp`, tối đa 5 MB; output được kiểm tra bằng Zod.
- `GET /api/ai/analyses` trả tối đa 20 kết quả gần nhất của user đã xác thực.
- Tác vụ AI lưu ảnh trong private bucket `traffic-images` và ghi kết quả vào `ai_analyses` theo user id. `GET /api/ai/analyses` chỉ đọc lịch sử của user hiện tại, tối đa 20 mục. Migration RLS giới hạn Storage/DB theo tài khoản.
- `/api/routes/calculate` nhận danh sách điểm theo thứ tự và loại xe `car` hoặc `motorcycle`; N1 endpoints chưa triển khai vẫn trả HTTP 501.
