# API contracts

Các schema/DTO được định nghĩa một lần ở `packages/shared/src`. Frontend/backend cùng import.

- JSON position: `{ "lat": 10.77, "lng": 106.69 }`; GeoJSON `[106.69, 10.77]`.
- Server trả `distanceMeters`, `durationSeconds`; frontend mới chuyển đơn vị.
- Success: `{ "data": T }`. Error: `{ "error": { "code": "...", "message": "..." } }`.
- Kết quả định tuyến có `source: 'vietmap'`, `coordinates` theo GeoJSON `[lng,lat]` và danh sách hướng dẫn rẽ. Không có tuyến mẫu dự phòng.
- `POST /api/routes/calculate` nhận danh sách điểm theo thứ tự, loại xe `car` hoặc `motorcycle`, và trả `distanceMeters`, `durationSeconds`, hình học tuyến và các bước chỉ dẫn.
- Phần TODO trả HTTP 501 với message rõ ràng.
- N2 sẽ bổ sung `Authorization: Bearer JWT` và RLS trước khi public.
