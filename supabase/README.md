# Supabase – owner N2

Liên kết project bằng Supabase CLI để giữ migration history đồng bộ:

```sh
supabase login
supabase link --project-ref <project-ref>
supabase db push --linked
```

Lệnh cuối áp dụng lần lượt `migrations/0001_initial.sql` đến `migrations/0005_backend_hardening.sql`. Migration thứ hai thiết lập Auth/RLS, RPC PostGIS, báo cáo cộng đồng và private Storage bucket; migration thứ ba gỡ metadata/quota AI cũ và gắn ảnh minh chứng vào traffic reports; migration thứ tư tổng hợp các xác nhận gần đây mà vẫn giữ từng báo cáo gốc; migration thứ năm thêm quota dùng chung giữa các API instances cho phân tích ảnh, điểm dừng và voice, đồng thời tuần tự hóa giới hạn tạo báo cáo theo tài khoản. Có thể chạy SQL thủ công theo đúng thứ tự trong Dashboard, nhưng cần đánh dấu migration đã áp dụng trước khi quay lại dùng CLI.

Sau đó bật `pg_cron` trong Dashboard và chạy `ops/traffic-expiry-cron.sql` một lần. `GET /api/traffic-reports` vẫn ẩn ngay các báo cáo quá hạn nếu Cron chưa bật; Cron cập nhật trạng thái DB và phát Realtime event đúng lúc.

Không dùng secret key trong web. API nhận publishable key cùng access token của người dùng; Storage upload dùng phiên đăng nhập ở web và được giới hạn bằng RLS.


## Sửa lỗi RPC migration 0002–0004 (08/11/2026)

Đã sửa lỗi PostgreSQL `42P13: cannot change return type of existing function` khi hàm RPC đã tồn tại với cột trả về khác.

- Tạo lại các RPC có kiểu trả về thay đổi bằng `DROP FUNCTION IF EXISTS` theo đúng chữ ký, không dùng `CASCADE`; cấp lại quyền gọi hàm sau khi tạo.
- Xử lý cả hai chữ ký 7/8 tham số của `create_traffic_report` để tránh trùng overload khi chạy lại.
- Mỗi file có transaction và thông báo PostgREST tải lại schema sau commit.

Sau khi có schema từ `0001`, chạy **toàn bộ từng file theo thứ tự `0002 → 0003 → 0004`**. Khi phát lại chuỗi migration, cần kết thúc ở `0004` để giữ cấu trúc RPC mới nhất. Nếu SQL Editor còn query cũ, mở query mới và copy lại nội dung file đã sửa.

`repairs/0002_rpc_return_type_v2.sql` là bản sao thủ công của `0002`, có dòng nhận diện `FIXED-0002-RPC-RETURN-TYPE-v2`; dùng thay cho `0002`, không phải migration bổ sung.

Migration `0005` giới hạn Gemini traffic-image analysis ở 10 lượt/tài khoản/giờ và tìm điểm dừng/voice ở 5 lượt/tài khoản/phút cho từng tính năng. API chỉ gọi quota ảnh khi Gemini được bật; các hạn mức được tăng atomically trong Postgres để mọi instance dùng chung. Job `expire_stale_traffic_reports()` dọn bucket quota cũ hơn 48 giờ.

## Trạng thái áp dụng

| Migration | Đã chạy trên Supabase thật | Ghi chú |
| --- | --- | --- |
| `0005_backend_hardening.sql` | Có (11/11/2026, do chủ dự án chạy) | Bắt buộc cho API: nếu thiếu, `consume_user_feature_quota` không tồn tại và tìm điểm dừng/voice trả 503 `FEATURE_QUOTA_UNAVAILABLE`. |

Dự án Supabase mới phải chạy đủ `0001 → 0005` theo thứ tự. Migration `0005` xóa rồi tạo lại `create_traffic_report`, nên nên chạy lúc ít người dùng.

Lưu ý: `0003` giữ hành vi có sẵn là xóa bảng metadata/quota AI cũ; không xóa file ảnh trong Storage.

Đã kiểm tra bằng PostgreSQL nhúng (PGlite): chạy mới, chạy lặp từng file, phát lại cả chuỗi trên schema cuối, bảo toàn bản ghi giao thông mẫu, chữ ký RPC và quyền gọi, rollback khi lỗi. Auth/Storage/Realtime/PostGIS được mô phỏng trong kiểm tra này; đây không phải kiểm thử end-to-end trên Supabase thật.
