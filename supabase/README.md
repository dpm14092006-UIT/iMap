# Supabase – owner N2

`migrations/0001_initial.sql` là blueprint sơ khởi, RLS đã bật nhưng chưa có policy public; thêm policies và Storage trước khi kết nối app. Geometry sử dụng PostGIS extension schema `extensions` như cấu hình Supabase thường dùng; kiểm tra schema thực tế của project. Không dùng bảng traffic báo cáo từ RAM với bảng production như cùng một nguồn dữ liệu.
