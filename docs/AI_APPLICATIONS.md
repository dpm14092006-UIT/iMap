# Ứng dụng AI thực tế cho RouteTwin

## Hướng sản phẩm

AI hỗ trợ người đi đường và người gửi báo cáo trong những việc có đầu vào rõ ràng. Dữ liệu định tuyến, vị trí, thời gian và trạng thái sự cố vẫn do API/PostGIS/VietMap quyết định; mô hình không được tự bịa tình hình đường hoặc tự sửa lộ trình.

## Ưu tiên triển khai

| Ưu tiên | Tính năng | Lợi ích thực tế | Dữ liệu cần có | Quy tắc an toàn |
| --- | --- | --- | --- | --- |
| P0 | **Trợ lý ảnh ngay trong Báo cáo giao thông**: gợi ý loại/mức độ sự cố và viết nháp ghi chú | Giảm thao tác nhập, làm báo cáo cộng đồng nhất quán hơn | Ảnh do người gửi chủ động chọn, vị trí do người dùng chọn | Không gửi báo cáo tự động; người dùng sửa và xác nhận; ảnh tĩnh không thể xác định tốc độ hay tình hình hiện tại |
| P0 | **Đọc biển báo từ ảnh trong cùng biểu mẫu** | Giúp người dùng hiểu chữ/nhóm biển báo khi ảnh đủ rõ | Ảnh do người dùng chọn | Hiển thị độ tin cậy; không kết luận hiệu lực pháp lý và không tự thay đổi tuyến; cần ngữ cảnh chiều đường, biển phụ, vị trí và thời điểm |
| P1 | **Tổng hợp xác nhận cộng đồng quanh một điểm** | Nhiều báo cáo độc lập gần nhau về thời gian và vị trí là bằng chứng kẹt xe đáng tin hơn; giúp đánh giá mức độ và độ mới của cảnh báo | Vị trí, loại sự cố, thời điểm, trạng thái và mã người gửi để đếm người xác nhận riêng biệt | Giữ từng báo cáo. Bản đầu tổng hợp cùng loại sự cố trong bán kính 75 m, 30 phút; hiển thị tổng báo cáo, số người gửi riêng biệt và lần cập nhật gần nhất. Cùng một tài khoản không được tính nhiều người. Bán kính chỉ là xấp xỉ vị trí, chưa thay thế map-matching vào cùng đoạn đường |
| P1 | **Tóm tắt sự cố trên hành trình** | Cho biết các báo cáo cộng đồng đang hoạt động gần tuyến trước khi đi | Hình học tuyến từ N1, vị trí/bán kính, thời hạn và trạng thái báo cáo PostGIS | API lọc sự cố trên hành lang tuyến; AI chỉ tóm tắt các bản ghi đã lọc và dẫn thời gian/vị trí, không tạo cảnh báo mới |
| P2 | **Chuẩn hóa ghi chú giọng nói thành báo cáo** | Hữu ích khi người dùng cần nhập liệu rảnh tay | Lời nói do người dùng chủ động ghi, loại sự cố và vị trí | Dùng như bản nháp để người dùng sửa; không khuyến khích ghi hình/ghi âm khi đang lái xe |

## Không ưu tiên lúc này

- Chatbot hỏi đáp “đường đang thế nào?” khi chưa có nguồn dữ liệu giao thông trực tiếp đáng tin cậy. Mô hình ngôn ngữ không thể biết tình hình hiện tại từ dữ liệu tĩnh.
- AI tự điều khiển, tự đổi tuyến từ ảnh biển báo, hoặc tự xác nhận/xóa báo cáo. Những thao tác này cần dữ liệu có cấu trúc và quyết định của người dùng.
- Nhận diện video/camera liên tục. Chi phí, quyền riêng tư và yêu cầu đo kiểm thực địa cao hơn đáng kể so với báo cáo ảnh người dùng gửi.

## Phạm vi AI ảnh hiện tại

Hai tác vụ Gemini nằm trong khu vực **Báo cáo giao thông**, không có trang hoặc mục AI Vision riêng. Backend nhận ảnh JPG/PNG/WebP tối đa 5 MB, yêu cầu đăng nhập, không ghi log ảnh/prompt, yêu cầu phản hồi JSON và kiểm tra lại bằng schema trước khi trả cho giao diện. Gemini nhận `store: false`; kết quả chỉ dùng để điền gợi ý trong form và không được lưu thành báo cáo nếu người dùng chưa bấm gửi. Chức năng mặc định tắt; cần cấu hình `GEMINI_API_KEY` và đặt `GEMINI_TRAFFIC_AI_ENABLED=true` sau khi rà soát phạm vi người dùng và điều khoản.

Khi dùng Gemini API ở gói miễn phí, Google có thể dùng nội dung yêu cầu để cải thiện sản phẩm và nội dung có thể được người đánh giá xử lý theo điều khoản dịch vụ. Google cũng ghi trong Gemini API Additional Terms rằng API không được dùng trong ứng dụng hướng tới hoặc có khả năng được người dưới 18 tuổi sử dụng. RouteTwin là bản đồ cộng đồng có thể phục vụ công chúng, nên cần xác định nhóm tuổi và rà soát điều khoản trước khi bật Gemini cho môi trường công khai. Với bất kỳ gói nào, giao diện phải báo rõ trước khi gửi ảnh; người dùng nên tránh ảnh có khuôn mặt hoặc biển số. Dữ liệu báo cáo công khai/nhạy cảm cần được cân nhắc kỹ.

## Cách triển khai theo đợt

1. Hoàn tất hai tác vụ ảnh trong Báo cáo giao thông và kiểm tra với ảnh đủ rõ, ảnh mờ, ảnh không liên quan, ảnh không có biển báo.
2. Đo tỷ lệ gợi ý được người dùng chấp nhận/sửa, tỷ lệ “không chắc chắn”, độ trễ và lỗi Gemini; không đánh giá chỉ bằng cảm giác.
3. Tổng hợp xác nhận bằng PostGIS và người gửi riêng biệt; giữ các báo cáo gốc để cộng đồng có thể đối chiếu. Bán kính lân cận là bản đầu cho đến khi có map-matching vào cùng đoạn đường. Chỉ cân nhắc AI nếu cần phân loại nội dung ghi chú, không dùng AI để quyết định xóa/gộp báo cáo.
4. Sau khi N1 trả geometry tuyến thật, bổ sung truy vấn sự cố trong hành lang tuyến và chỉ dùng AI để diễn đạt lại kết quả có nguồn.

## Tài liệu tham khảo

- [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding): ảnh inline, định dạng hỗ trợ và hướng dẫn ảnh rõ/đúng chiều.
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output): ép kết quả theo schema và vẫn phải kiểm tra dữ liệu trong ứng dụng.
- [Gemini Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview): dùng `store=false` để không lưu Interaction.
- [Gemini API terms](https://ai.google.dev/gemini-api/terms): cách Google xử lý dữ liệu ở dịch vụ miễn phí và có phí.
