# Brief thiết kế lại giao diện iMap (dán nguyên văn vào ChatGPT)

---

Bạn là product designer. Hãy thiết kế lại giao diện cho **iMap**, một web app bản đồ và chỉ đường cho người Việt. Người dùng chính đi **xe máy** ở Hà Nội và TP.HCM, dùng cả trên điện thoại lẫn máy tính.

## Bối cảnh

- Stack hiện tại: React + TypeScript + Tailwind CSS, bản đồ Leaflet (nền OpenStreetMap), tuyến đường tính qua API VietMap. Giao diện phải làm được bằng Tailwind và không đòi đổi engine bản đồ.
- Giao diện hiện tại bị chê **rối**: có khoảng 15 khối nổi trên màn hình (thanh dọc 5 nút, ô tìm kiếm, 6 chip màu khác nhau, nút ngôn ngữ, nút thông tin, nút đăng nhập, thẻ "Khu vực này", nút lớp, chú giải giao thông, 4 nút zoom/định vị). Có quá nhiều màu nhấn, gradient tím, chức năng bị lặp (Nhiều điểm trùng "Thêm điểm dừng"; Giao thông vừa là tab, vừa là lớp, vừa có chú giải). Ngoài ra web tự chuyển sang giao diện tối theo giờ.
- Đã thử 2 hướng và **đều bị loại**:
  1. Bản sao Google Maps (nền trắng, ô tìm kiếm góc trái, panel trái): bị chê "giống Google, không có bản sắc".
  2. Khung màu mực đen trên bản đồ tông giấy, thanh lệnh ở giữa đáy, font mono cho số: bị chê "style quá xấu".
  → Đừng lặp lại hai hướng này.

## Chức năng phải có chỗ trong giao diện

1. Tìm địa điểm, có gợi ý (phím tắt / và ⌘K). Tìm theo danh mục quanh đây (nhà hàng, cà phê, khách sạn, điểm tham quan, bảo tàng…) và tìm dọc tuyến đang đi.
2. Chỉ đường: xe máy / ô tô; chọn tiêu chí (nhanh nhất…); tránh phà; đi ngay hoặc hẹn giờ; thêm điểm dừng; chọn điểm trên bản đồ; dùng vị trí hiện tại; so sánh nhiều tuyến; lưu tuyến; chia sẻ link tuyến hoặc địa điểm.
3. Lộ trình nhiều điểm (đi qua nhiều điểm dừng).
4. Tuyến đã lưu.
5. Giao thông cộng đồng:
   - Xem báo cáo trên bản đồ và dạng danh sách.
   - Gửi báo cáo: loại (kẹt xe, tai nạn, thi công, ngập đường, đường đóng, vật cản), mức độ (nhẹ/vừa/nặng), áp dụng cho loại xe, ghi chú, ảnh. Cần đăng nhập.
   - Xác nhận báo cáo còn hay đã hết.
6. Cảnh báo kẹt xe trên tuyến đang đi, gợi ý đổi tuyến, thông báo đẩy.
7. Dẫn đường GPS: chỉ dẫn rẽ, khoảng cách, đồng hồ tốc độ, giọng nói bật/tắt, tự tính lại khi đi lệch, báo sự cố nhanh khi đang đi, nút về giữa vị trí.
8. Trợ lý địa điểm AI (cần đăng nhập): hỏi bằng ngôn ngữ tự nhiên, gợi ý chỗ, thêm làm điểm dừng.
9. Chi tiết địa điểm: tên, loại, địa chỉ, chỉ đường tới, lưu.
10. Lớp bản đồ: đường phố / tối / vệ tinh; lớp phủ giao thông, sự cố, địa hình. Có chú giải màu giao thông.
11. Tài khoản (đăng nhập/đăng ký), ngôn ngữ VI/EN, thông báo có bản cập nhật.

## Ràng buộc

- Mobile trước: dùng được một tay, nút ≥ 44px, chữ dễ đọc khi đứng ngoài nắng.
- Bản đồ là nhân vật chính: lúc mở web, các khối nổi không che quá ~20% màn hình.
- Tối đa 1 màu nhấn thương hiệu. Xanh/vàng/đỏ dành riêng cho trạng thái giao thông.
- Hỗ trợ tiếng Việt có dấu đầy đủ, chữ không bị cắt.
- Có giao diện sáng và tối, theo cài đặt hệ thống.
- Đạt WCAG AA về tương phản.

## Tôi cần bạn trả về

1. **3 hướng phong cách khác nhau rõ rệt.** Mỗi hướng gồm: tên, mô tả 2–3 câu, bảng màu (mã hex), font (có hỗ trợ tiếng Việt), độ bo góc, kiểu bóng đổ, và ví dụ một app hay sản phẩm có cảm giác tương tự. Kèm **ảnh mockup màn hình chính mobile** cho từng hướng.
2. Sau khi tôi chọn một hướng, hãy làm tiếp:
   - Ảnh mockup cho các màn: Trang chủ (mobile + desktop), Chỉ đường, Danh sách giao thông + gửi báo cáo, Đang dẫn đường, Trợ lý AI, Chi tiết địa điểm.
   - Sơ đồ bố cục: cái gì nằm ở đâu, cái gì ẩn vào menu.
   - Design tokens dạng `tailwind.config` (colors, fontFamily, borderRadius, boxShadow) để tôi gắn thẳng vào code.

Viết bằng tiếng Việt.

---

<!-- Ghi chú cho bạn (không dán phần này): nếu có ảnh chụp giao diện hiện tại, đính kèm cùng prompt để ChatGPT thấy chỗ rối. -->
