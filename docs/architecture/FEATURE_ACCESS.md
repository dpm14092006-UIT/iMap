# Quyền sử dụng tính năng

| Tính năng | Khách | Thành viên đã đăng nhập |
|---|---|---|
| Xem bản đồ, đổi lớp, định vị | Có | Có |
| Tìm tên/địa chỉ, chỉ đường, nhiều điểm | Có | Có |
| Lưu hành trình trên thiết bị | Có | Có |
| Xem báo cáo giao thông | Có | Có |
| Gửi/xác nhận báo cáo | Không | Có |
| Trợ lý địa điểm, gồm rules fallback | Không | Có |
| Tìm điểm dừng theo nhu cầu dọc tuyến | Không | Có |
| Voice trình duyệt và Whisper API trong trợ lý | Không | Có |
| AI phân tích ảnh/biển báo giao thông | Không | Có |

Phiên Supabase anonymous không được tính là thành viên (API trả403 ACCOUNT_REQUIRED). Tài khoản đăng ký nhưng chưa có session (ví dụ chưa xác nhận email) chưa mở khóa. Không có gói trả phí hoặc vai trò admin mới. Tính năng dùng nhà cung cấp vẫn cần cấu hình key/quota kể cả đã đăng nhập.

Web và API phải cấu hình cùng Supabase project: frontend dùng VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY, backend dùng SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY (hoặc anon key). Không dùng service_role key để xác thực người dùng.

## Kiểm tra ở server

- `/api/route-stops/*`, `/api/voice/*` dùng `requireAuth` trước parser/provider/quota và trước nhận binary audio.
- API phân tích ảnh giao thông và gửi/xác nhận báo cáo đã có cùng middleware.
- Frontend gửi Supabase access token qua `Authorization: Bearer ...`. Server xác minh token bằng `supabase.auth.getUser(token)`, không tin userId từ request, không chỉ decode JWT.
- Thiếu token:401 AUTH_REQUIRED. Token không hợp lệ/hết hạn:401 INVALID_SESSION. Supabase Auth lỗi:503 AUTH_UNAVAILABLE, không chạy provider.
- Limiter route-stop và voice chuyển sang 5 lần/phút/tài khoản thay vì IP, vẫn tối đa2 request đang xử lý mỗi instance. Bộ đếm trong RAM không phải quota toàn cục trên serverless.

## Giao diện

Khách vẫn thấy mục Trợ lý nhưng có nhãn Đăng nhập. Mở mục này hiển thị lợi ích thành viên và liên kết `/login` (có cả tab đăng ký); không mount form trợ lý, không kiểm tra voice hay xin quyền micro. Trong lúc khôi phục session hiện loading. Thành viên thấy form trợ lý đầy đủ. Đăng xuất hoặc đổi tài khoản unmount trợ lý, hủy request và dừng microphone; đổi access token hủy phiên voice API cũ và tải lại config.

## Kiểm tra

HTTP tests trên `createApp` thật: mọi endpoint AI thiếu/giả token đều bị chặn, lỗi dịch vụ auth trả503, parser không được gọi; endpoint tìm địa chỉ/chỉ đường vẫn nhận request khách. Các ca thành công của route-stop/voice chạy qua middleware thật với Supabase getUser fixture. UI đã kiểm tra khách → trang mời đăng nhập → đăng nhập bằng Supabase SDK với Auth HTTP fixture → mở trợ lý → gửi câu mơ hồ qua API có Bearer token → nhận câu hỏi làm rõ. Server ghi nhận2 lần xác minh user và1 lần tìm; đăng xuất ở tab khác tự khóa lại trợ lý. Các phiên này là tài khoản mô phỏng, không xác minh Supabase production. Không tạo tài khoản người dùng thật trong kiểm thử.
