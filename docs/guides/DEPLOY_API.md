# Deploy web và API

Cấu hình deploy được chuẩn bị cho Vercel Express và Vite; chưa đưa lên tài khoản hosting trong tác vụ này. Không cần chạy Whisper model trong Vercel Function.

```text
Vite HTTPS → Express HTTPS /api/route-stops/explore → intent → Overpass → VietMap (khi định tuyến)
Vite → SpeechSynthesis / Web Audio (chỉ phát chỉ dẫn và cảnh báo)
```

## 1. API Express trên Vercel

Import repo GitHub, chọn nhánh `main` cho bản tích hợp. Tạo project với **Root Directory = apps/api**, Framework Preset Express. Bật **Include source files outside of the Root Directory in the Build Step** vì API dùng `packages/shared` trong monorepo. Node22. Install `npm ci` tại workspace root (Vercel nhận npm workspaces qua lockfile ở root); Build Command từ `apps/api/vercel.json`: `npm run build -w @routetwin/shared`. Không chọn output directory `dist` như frontend. Express entry `src/app.ts` có default export, không tự listen. Timeout function 60 giây; AI10/15s, Overpass10s, tối đa5 route calls có thể vẫn timeout khi nhà cung cấp chậm.

Đặt biến server (Production và Preview tùy nhu cầu):

| Biến | Giá trị/ý nghĩa |
|---|---|
| `CORS_ORIGIN` | Origin web chính xác, ví dụ `https://imap-web.vercel.app`; nhiều origin cách nhau dấu phẩy, không kèm path/slash cuối |
| `VIETMAP_API_KEY` | Key tìm kiếm và định tuyến hiện có |
| `VIETMAP_TILEMAP_API_KEY` | Key có quyền Tilemap nếu dùng key riêng. Bỏ trống để dùng `VIETMAP_API_KEY` cho cả Tilemap. |
| `RATE_LIMIT_POI_PER_MIN`, `RATE_LIMIT_ROUTES_PER_MIN`, `RATE_LIMIT_PLACES_PER_MIN`, `RATE_LIMIT_OPTIMIZE_PER_MIN` | Lượt/phút/IP cho tìm POI (20), tính tuyến (30), gợi ý/chi tiết/reverse (60), tối ưu nhiều điểm (10). Bộ đếm trong RAM mỗi instance serverless, không phải giới hạn toàn cục |
| `TRUST_PROXY_HOPS` | Đặt `1` khi chạy sau proxy của Vercel để `req.ip` là IP máy khách; mặc định `0` (nếu để 0 sau proxy, mọi người dùng chung một bộ đếm) |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Cấu hình Supabase hiện có để tính năng traffic/auth liên quan hoạt động |
| `OVERPASS_API_URL` | Mặc định `https://overpass-api.de/api/interpreter`; public service best effort |
| `STOP_AI_PROVIDER` | `off` mặc định; hoặc `gemini` nếu muốn model hiểu intent |
| `STOP_AI_MODEL`, `GEMINI_API_KEY` | Chỉ cần khi dùng Gemini; chọn model có free quota trong tài khoản, không bật billing nếu yêu cầu miễn phí |

Ollama local chỉ dùng phát triển. `localhost:11434` trên Vercel không trỏ về máy cá nhân; deploy có AI phải chọn provider truy cập được qua Internet. Chưa có Gemini key/model thì trả rules minh bạch, không tự gọi model khác.

## 2. Âm thanh đầu ra

Thu âm và Whisper API đã được gỡ từ 19/11/2026. Không cần Cloudflare token. Lời chỉ dẫn dùng SpeechSynthesis của trình duyệt; chuông cảnh báo dùng Web Audio. Kiểm tra nút loa trên thiết bị thật sau deploy.

## 3. Web Vite trên Vercel

Tạo project thứ hai, Root Directory `apps/web`, Framework Vite, bật source ngoài root. Build/Output từ `apps/web/vercel.json` (build shared rồi web; output `dist`).

```dotenv
VITE_API_BASE_URL=https://TEN-PROJECT-API.vercel.app/api
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

`VITE_API_BASE_URL` phải có `/api`, không slash cuối. Bản đồ nền lấy style, tile và tài nguyên VietMap qua cùng API đã cấu hình. Key Tilemap chỉ đặt ở backend. Frontend Vite đóng gói biến lúc build, đổi env cần redeploy. Local vẫn `/api`, Vite proxy đến4000. RouteApiClient đã dùng env này, không còn buộc `/api` cùng origin. Supabase public key là key public; tuyệt đối không dùng service_role key. Cập nhật API CORS_ORIGIN bằng origin web sau khi có domain. Preview domain phải được allowlist rõ ràng nếu cần thử.

Nhánh `main` là bản tích hợp sau khi hợp nhất các nhánh chức năng và tái cấu trúc. Dùng `main` cho Production Branch của cả web và API. Cấu hình key của từng dịch vụ vẫn cần thiết.

Chạy migration theo thứ tự `0001`–`0009` trên Supabase. Migration `0009_push_endpoint_allowlist.sql` giới hạn endpoint Web Push và dọn đăng ký không hợp lệ đã lưu trước đó; việc merge Git không tự áp dụng thay đổi SQL lên database.

## 4. Kiểm tra sau deploy

1. `GET https://API/api/health` trả 200. Các endpoint `/api/voice/*` cũ trả 404.
2. Đăng nhập tài khoản test, mở Trợ lý địa điểm: chỉ còn Chọn thao tác và Nhập nhu cầu; không có nút micro hoặc yêu cầu quyền thu âm.
3. Nhập nhu cầu, bấm Tìm; thử quanh vị trí và dọc tuyến, thêm/bỏ điểm ghé.
4. Bắt đầu dẫn đường, kiểm tra chỉ dẫn đọc theo ngôn ngữ giao diện, cảnh báo sự cố và nút bật/tắt loa. Dừng chuyến đi phải dừng lời đọc. Kiểm tra bằng thiết bị thật vì bộ kiểm thử giả lập không chứng minh loa hoặc giọng hệ thống hoạt động.

## Docker thay thế (API Node)

```sh
docker build -f apps/api/Dockerfile -t imap-api .
docker run --rm -p 4000:4000 --env-file apps/api/.env imap-api
```

Build context là root repo. Container chạy user node, nhận `PORT` hoặc `API_PORT`; mặc định4000. Dockerfile dành cho Express proxy/POI, không nhúng model Whisper. Docker runtime chưa có trên máy kiểm tra nên chưa chạy build container. Hosting Docker có miễn phí hay không phụ thuộc nhà cung cấp/tài khoản, không cam kết.

## Nguồn chính thức (đã tra 09/11/2026)

- [Express on Vercel](https://vercel.com/docs/frameworks/backend/express)
- [Vercel monorepos](https://vercel.com/docs/monorepos)
- [Vercel Function limits](https://vercel.com/docs/functions/limitations)
