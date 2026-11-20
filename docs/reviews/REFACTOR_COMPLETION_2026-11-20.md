# Hoàn tất phần cấu trúc và giao diện — 20/11/2026

Commit nền `a8db088` đã được xác minh và push trước khi tiếp tục đợt này.

## Phạm vi hoàn thành

- Tách TrafficReportPanel, PlaceAssistantPanel, PlaceCombobox, RoutePanel, MultiStopPanel thành các phần nhập liệu/bộ lọc/kết quả và hook điều phối. Logic thuần không nằm trong adapter hoặc component.
- Tách CSS theo token/base/control/shell/Leaflet; thêm Button, Input, Select, Textarea. Bỏ selector theme dò chuỗi class. Tên variant Button là chuỗi tĩnh để Tailwind không loại nhầm CSS khi build.
- Gom haversine và xử lý dấu tiếng Việt vào packages/shared, giữ bán kính lịch sử của web qua wrapper.
- Chuyển README module my-routes chưa triển khai sang docs/features; cập nhật cây thư mục, kiến trúc và design system.
- Thêm 81 test: primitive shared, control native, combobox, hook trợ lý/báo cáo/nhiều điểm và tám lớp Leaflet cùng Canvas lifecycle.

## Lỗi phát hiện và sửa

- Tuyến không có phương án thay thế vẫn phải zoom vừa tuyến chính.
- Focus pin phải cập nhật tooltip khi đổi tên tại cùng tọa độ.
- Huỷ tìm kiếm trợ lý khi đổi tài khoản; huỷ phân tích ảnh khi đổi ảnh/token hoặc unmount.
- Tối ưu nhiều điểm không được hồi sinh hành trình sau reset/đổi tuỳ chọn/unmount; chặn request lặp cùng một nhịp.
- Escape trong popup địa điểm phải được xử lý trước panel; blur phải huỷ việc resolve địa điểm đang chờ.
- Canvas Leaflet 1.9 có thể còn callback RAF sau khi bị huỷ. Adapter LifecycleCanvas bảo vệ callback đó; dọn đường vẽ trước map và gỡ listener zoom của RouteLayer. Có test Chromium thật và unit test sau dispose.

## Xác minh

`npm run verify -- --shuffle=1` đạt đủ format, ESLint không warning, typecheck runtime/test, export/import audit so với main, JSX props audit, unit API/web/shared, xáo trộn seed 1000 và build production.

`npm run test:browser` dùng Vite riêng và Chromium thật: route không có alternatives, click tuyến/POI, GPS và heading, popup giao thông, overlay, đổi kích thước, nhãn mobile, huỷ/tạo lại map, form chỉ đường, mount panel, theme và không tràn ngang. API/tile trong script là fixture; không gọi provider trả phí. Lần kiểm tra ban đầu cũng đã tải tile OpenStreetMap thật trên trình duyệt.

Giới hạn: chưa xác minh GPS/âm thanh trên thiết bị, Supabase RLS hoặc Web Push đầu cuối. Các phát hiện API ngoài sáu mục bàn giao (SSRF push, quota, outbox và tránh phà của trợ lý) vẫn được theo dõi trong báo cáo xác minh trước; không coi chúng là đã sửa trong đợt tổ chức giao diện này.
