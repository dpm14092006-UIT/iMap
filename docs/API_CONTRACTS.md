# API contracts

Các schema/DTO được định nghĩa một lần ở `packages/shared/src`. Frontend/backend cùng import.

- JSON position: `{ "lat": 10.77, "lng": 106.69 }`; GeoJSON `[106.69, 10.77]`.
- Server trả `distanceMeters`, `durationSeconds`; frontend mới chuyển đơn vị.
- Success: `{ "data": T }`. Error: `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`.
- Mỗi phản hồi API có header `X-Request-Id`; dùng giá trị này khi tra log lỗi.
- Kết quả định tuyến có `source: 'vietmap'`, `coordinates` theo GeoJSON `[lng,lat]` và danh sách hướng dẫn rẽ. Không có tuyến mẫu dự phòng.
- `GET /api/traffic-reports` nhận `minLat`, `minLng`, `maxLat`, `maxLng`; trả tối đa 200 báo cáo còn hạn trong bounding box. `GET /api/traffic-reports/geojson` trả cùng dữ liệu thành GeoJSON `[lng,lat]`.
- DTO báo cáo có thể kèm `communityReportCount`, `communityReporterCount` và `communityUpdatedAt`. Đây là tổng hợp cùng loại sự cố trong 75 m/30 phút; không xóa hoặc gộp báo cáo gốc, và chưa phải xác nhận cùng đoạn đường bằng map-matching.
- Tạo báo cáo và xác minh báo cáo yêu cầu `Authorization: Bearer <Supabase access token>`.
- `POST /api/traffic-reports` nhận JSON `TrafficReportInput`. `POST /api/traffic-reports/:id/clearance` nhận `{ "state": "clear" | "still_active" }`.
- Ảnh báo cáo được tải lên private bucket `traffic-images` bằng phiên người dùng với MIME JPG/PNG/WebP, tối đa 5 MB. `POST /api/traffic-reports` nhận `imagePath` tuỳ chọn sau khi người dùng tải ảnh lên; RPC xác minh đường dẫn thuộc tài khoản gửi báo cáo.
- `POST /api/traffic-reports/analyze-image?task=incident|traffic_sign` nhận ảnh nhị phân JPG/PNG/WebP tối đa 5 MB và yêu cầu đăng nhập. Gemini chỉ hoạt động khi backend được bật; quota là 10 lượt/tài khoản/giờ trên toàn bộ API instances. Kết quả là gợi ý để người dùng xem lại trước khi gửi báo cáo.
- `/api/route-stops/search`, `/api/route-stops/explore` và `/api/voice/transcribe` yêu cầu tài khoản đã đăng nhập, tối đa 5 lượt/tài khoản/phút cho mỗi tính năng trên toàn bộ API instances.
- Snapshot báo cáo trả `imagePath` để ứng dụng có thể tạo signed URL. RLS cho phép chủ ảnh đọc ảnh của họ và người dùng đã đăng nhập đọc ảnh của báo cáo còn hiệu lực.
- `/api/routes/calculate` nhận danh sách điểm theo thứ tự và loại xe `car` hoặc `motorcycle`. `/api/routes/algorithm` và `/api/routes/optimize` đang được tích hợp. `/api/my-routes` hiện trả HTTP 501; tuyến đã lưu trong phiên bản này nằm trên trình duyệt.
