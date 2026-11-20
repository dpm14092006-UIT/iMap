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

## Bổ sung theo yêu cầu: xoá Demo

Sau commit cấu trúc `2c26e8c`, đã gỡ toàn bộ chế độ Demo/thuyết trình khỏi web: toggle trên topbar, tham số/đọc storage, GPS chạy tự động, tạm dừng/rẽ nhầm, tạo sự cố giả, feature algorithm-lab, overlay thuật toán và bộ chọn TSP chỉ dành cho thuyết trình. Tên model báo cáo đổi từ DemoIncident thành TrafficIncident.

Dẫn đường chỉ dùng BrowserGpsSource. Adapter chặn callback đã xếp hàng sau clearWatch để vị trí/lỗi của chuyến cũ không ghi sang chuyến mới. Thêm 21 test cho adapter GPS và vòng đời chuyến đi; giữ kiểm tra chống tải dồn qua 350 lần camera di chuyển.

Đã chạy lại toàn bộ verify và browser với native Geolocation API do Chromium cấp vị trí kiểm thử. URL `?demo=1` và storage cũ không bật lại Demo. Đã mở thêm bản cuối với tile thật: tải 35 tile, không có lỗi JavaScript và không còn nút Demo. API và benchmark thuật toán vẫn độc lập với giao diện đã gỡ. Các export/props bị xoá có lý do rõ trong manifest kiểm toán để không che giấu việc mất callback ngoài phạm vi này.

## Đóng các lỗi chức năng còn mở (tối 20/11)

| Mục | Sửa | Test bảo vệ |
| --- | --- | --- |
| **P1 SSRF Web Push** | Migration `0009_push_endpoint_allowlist.sql`: `is_allowed_push_endpoint()` chỉ nhận FCM, Mozilla, Apple, Windows qua HTTPS cổng 443; `save_push_subscription` dùng hàm này và dọn dòng đã lưu sai chính sách. API kiểm tra lại bằng `traffic/domain/pushEndpointPolicy.ts` ngay trước khi gửi, endpoint xấu bị xoá mà không phát request | 18 ca chính sách endpoint (IP nội bộ, metadata cloud, cổng lạ, userinfo, hậu tố giả…); notifier không gửi tới endpoint xấu. Regex SQL được đối chiếu cùng 18 ca, **chưa chạy trên Postgres thật** |
| Timeout gửi push | Mỗi lần `sendNotification` có `timeout: 10_000` | Notifier test kiểm tra tham số |
| Quota route-stops | `RouteStopsController` kiểm tra body → xin chỗ xử lý → trừ hạn mức ngay trước khi gọi use case; bỏ `requireFeatureQuota` chạy trước validation | Body sai và instance đầy không trừ lượt; hết lượt không gọi provider |
| Trợ lý và tránh phà | `RoutePlan.avoidFerry`; `RouteApiClient.createPlan(..., avoidFerry)` gửi `avoid: ['ferry']`; trợ lý tính lại tuyến khi tuyến đang tránh phà thay vì dùng tuyến dựng sẵn; tuyến đã lưu lấy tùy chọn từ tuyến | Thêm/bỏ điểm ghé giữ tiêu chí và tránh phà; API client gửi đúng body |

| Tính lại tuyến và tránh phà | `rerouteRequestSchema.avoidRoads`; `RerouteUseCase` gửi tùy chọn cho mọi tuyến ứng viên kể cả tuyến đi vòng; tự tính lại khi lệch tuyến và đề xuất đổi tuyến khi có sự cố đều gửi theo `RoutePlan.avoidFerry` và giữ cờ trên tuyến mới | Use case: mọi lần gọi provider đều mang `avoid: ['ferry']`; hook tính lại: gửi `avoidRoads` và tuyến mới vẫn tránh phà |

Còn mở: outbox/hàng đợi bền cho Web Push (hiện chỉ có timeout từng lần gửi và `Promise.race` 4 giây); cần chọn hạ tầng (Vercel `waitUntil`, Supabase queue hoặc worker riêng) trước khi triển khai.
