# Trang tài khoản iMap

## Luồng sử dụng

- Nhấn biểu tượng tài khoản ở góc bản đồ để mở `/login`.
- Trang riêng hỗ trợ đăng nhập email/mật khẩu, đăng ký, hiện/ẩn mật khẩu, đăng xuất và quay lại bản đồ.
- Desktop dùng form cạnh minh họa tuyến đường SVG; điện thoại ẩn minh họa và ưu tiên form. Bỏ khối quảng bá/thẻ tính năng lớn. Ô nhập trên mobile dùng chữ 16px để tránh tự zoom khi focus.
- Các hành động gửi/xác nhận báo cáo vẫn có thể mở AuthPanel ngay trong bản đồ; cả hai dùng chung `AccountForm` và `AuthProvider`.
- Thành công hiển thị trạng thái tài khoản và nút tiếp tục với bản đồ. Khi Supabase yêu cầu xác nhận email, đăng ký hiển thị hướng dẫn kiểm tra email và không giả định đã có phiên.

## Tích hợp kỹ thuật

`main.tsx` chọn AuthPage cho pathname `/login` (cả `/login/`). Các URL khác tiếp tục dùng App hiện tại. Điều hướng dùng liên kết thông thường; không bổ sung thư viện router. Hosting cần phục vụ `index.html` cho `/login` theo cấu hình SPA của Vite.

`AccountForm` gọi các phương thức hiện có của `AuthProvider`:

- `signIn` → `supabase.auth.signInWithPassword`.
- `signUp` → `supabase.auth.signUp`; kết quả có/không có session được xử lý riêng.
- `signOut` → `supabase.auth.signOut`.

Supabase tiếp tục quản lý lưu phiên, tự làm mới token và phát sự kiện auth. Mật khẩu chỉ ở state của form, được xóa khi đăng nhập/đăng ký thành công hoặc đổi chế độ; không tự lưu riêng. Form có label, autocomplete, trạng thái busy, lỗi `role=alert`, kết quả `role=status` và kiểm tra trường bắt buộc. Đăng ký yêu cầu tối thiểu 8 ký tự; đăng nhập không áp đặt giới hạn này cho tài khoản cũ.

Cấu hình frontend: `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` (hoặc `VITE_SUPABASE_ANON_KEY`). Chỉ dùng publishable/anon key với RLS phù hợp; không đưa service-role key vào frontend. Thiếu cấu hình thì hiện thông báo thân thiện và cho tiếp tục bản đồ.

## Kiểm tra

- Build shared và web (bao gồm TypeScript): đạt.
- Trình duyệt desktop và 390×844: bố cục đạt, form ưu tiên trên mobile, trang cuộn được.
- Chưa cấu hình: thông báo và đường quay lại bản đồ hoạt động.
- Dùng Supabase SDK thật với HTTP fixture local riêng: sai mật khẩu có lỗi, hiện/ẩn mật khẩu, đăng nhập thành công, khôi phục phiên sau reload, đăng xuất, đăng ký cần xác nhận email, chặn form rỗng bằng validation trình duyệt: đạt.
- Link về bản đồ hoạt động, nút tài khoản trỏ `/login`.

Fixture chỉ dùng dữ liệu giả tại localhost và không nằm trong source sản phẩm. Chưa kiểm tra tạo tài khoản/email delivery hoặc đăng nhập trên Supabase thật; các bước đó phụ thuộc cấu hình Auth của dự án triển khai.
