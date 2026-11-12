# Deploy web và API

Cấu hình deploy được chuẩn bị cho Vercel Express và Vite; chưa đưa lên tài khoản hosting trong tác vụ này. Không cần chạy Whisper model trong Vercel Function.

```text
Vite HTTPS → Express HTTPS /api/voice/transcribe → Cloudflare Workers AI Whisper
          → /api/route-stops/explore → intent → Overpass → VietMap (khi định tuyến)
```

## 1. API Express trên Vercel

Import repo GitHub, chọn nhánh `dpm` cho bản tính năng này. Tạo project với **Root Directory = apps/api**, Framework Preset Express. Bật **Include source files outside of the Root Directory in the Build Step** vì API dùng `packages/shared` trong monorepo. Node22. Install `npm ci` tại workspace root (Vercel nhận npm workspaces qua lockfile ở root); Build Command từ `apps/api/vercel.json`: `npm run build -w @routetwin/shared`. Không chọn output directory `dist` như frontend. Express entry `src/app.ts` có default export, không tự listen. Timeout function 60 giây; AI10/15s, Overpass10s, tối đa5 route calls có thể vẫn timeout khi nhà cung cấp chậm.

Đặt biến server (Production và Preview tùy nhu cầu):

| Biến | Giá trị/ý nghĩa |
|---|---|
| `CORS_ORIGIN` | Origin web chính xác, ví dụ `https://imap-web.vercel.app`; nhiều origin cách nhau dấu phẩy, không kèm path/slash cuối |
| `VIETMAP_API_KEY` | Key định tuyến hiện có; voice miễn phí không làm VietMap thành miễn phí |
| `RATE_LIMIT_POI_PER_MIN`, `RATE_LIMIT_ROUTES_PER_MIN`, `RATE_LIMIT_PLACES_PER_MIN` | Lượt/phút/IP cho tìm POI (20), tính tuyến (30), gợi ý/chi tiết/reverse (60). Bộ đếm trong RAM mỗi instance serverless, không phải giới hạn toàn cục |
| `TRUST_PROXY_HOPS` | Đặt `1` khi chạy sau proxy của Vercel để `req.ip` là IP máy khách; mặc định `0` (nếu để 0 sau proxy, mọi người dùng chung một bộ đếm) |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Cấu hình Supabase hiện có để tính năng traffic/auth liên quan hoạt động |
| `OVERPASS_API_URL` | Mặc định `https://overpass-api.de/api/interpreter`; public service best effort |
| `STOP_AI_PROVIDER` | `off` mặc định; hoặc `gemini` nếu muốn model hiểu intent |
| `STOP_AI_MODEL`, `GEMINI_API_KEY` | Chỉ cần khi dùng Gemini; chọn model có free quota trong tài khoản, không bật billing nếu yêu cầu miễn phí |
| `VOICE_STT_PROVIDER` | `cloudflare` để bật Whisper API; `off` để tắt |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID lấy từ dashboard Workers AI |
| `CLOUDFLARE_AI_TOKEN` | Token Workers AI theo template chính thức; chỉ ở backend |

Ollama local chỉ dùng phát triển. `localhost:11434` trên Vercel không trỏ về máy cá nhân; deploy có AI phải chọn provider truy cập được qua Internet. Chưa có Gemini key/model thì trả rules minh bạch, không tự gọi model khác. Cloudflare voice là mô hình ASR thật, độc lập với Gemini intent.

## 2. Cloudflare voice miễn phí có hạn mức

Giữ tài khoản ở **Workers Free**: Workers AI có 10.000 neurons/ngày; vượt hạn mức sẽ lỗi, không phát sinh phần dùng thêm của Workers Paid. Hạn mức dùng chung toàn tài khoản, reset00:00UTC. Đây không phải API miễn phí vô hạn. Nếu tài khoản đã ở Paid, quota vượt mức có thể tính phí; ứng dụng không thể kiểm tra hoặc đổi billing plan của bạn. Không dùng AI Gateway trả phí/fallback trong adapter này.

Dashboard Workers AI → Use REST API → Create Workers AI API Token, lấy Account ID/token và thêm vào env API Vercel. Model cố định `@cf/openai/whisper`, REST binary. Không cần deploy thêm Worker hay Docker model. Không đưa token vào biến `VITE_*` hoặc GitHub. Sau khi đặt env phải redeploy API.

Ứng dụng không lưu audio; xử lý trong RAM và chuyển provider khi người dùng bấm nhận dạng. Audio ≤15s, WAV≤500kB, timeout25s. Có limiter demo5/phút/tài khoản +2 active mỗi instance, **không phải giới hạn toàn cục/quota billing** trên serverless. Nếu public rộng, cần rate limit chung/auth và theo dõi quota dashboard. Không có chuyển nhà cung cấp trả phí khi Cloudflare lỗi.

Hugging Face Docker Spaces không được coi là lựa chọn deploy miễn phí mới: tài liệu hiện yêu cầu paid PRO/Team để tạo Docker/Gradio Space; static space miễn phí không chạy Python API.

## 3. Web Vite trên Vercel

Tạo project thứ hai, Root Directory `apps/web`, Framework Vite, bật source ngoài root. Build/Output từ `apps/web/vercel.json` (build shared rồi web; output `dist`).

```dotenv
VITE_API_BASE_URL=https://TEN-PROJECT-API.vercel.app/api
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

`VITE_API_BASE_URL` phải có `/api`, không slash cuối. Frontend Vite đóng gói biến lúc build, đổi env cần redeploy. Local vẫn `/api`, Vite proxy đến4000. RouteApiClient đã dùng env này, không còn buộc `/api` cùng origin. Supabase public key là key public; tuyệt đối không dùng service_role key. Cập nhật API CORS_ORIGIN bằng origin web sau khi có domain. Preview domain phải được allowlist rõ ràng nếu cần thử.

Nhánh `dpm` đã merge toàn bộ `main`, gồm trang `/login`, traffic AI và xác nhận cộng đồng; giữ trợ lý địa điểm, voice, cấu hình Vercel và sửa migration của dpm. Có thể chọn `dpm` để deploy bản tích hợp. Cấu hình key của từng dịch vụ vẫn cần thiết.

## 4. Kiểm tra sau deploy

1. `GET https://API/api/health` →200; `GET /api/voice/config` sau khi đăng nhập, có Bearer access token →`available:true` nếu đã cấu hình; khách nhận401. `true` chỉ chứng minh biến tồn tại, không chứng minh key còn quota/hợp lệ.
2. Đăng nhập bằng tài khoản test; gửi Bearer access token cùng câu “Find the station” đến `/api/route-stops/explore` →clarify không cần key VietMap.
3. Mở web HTTPS →Trợ lý địa điểm →Whisper API →cấp quyền micro →nói tiếng Anh ngắn →Xong →kiểm tra ô chữ. Chưa bấm Tìm thì chưa chạy POI query.
4. Bấm Tìm với vị trí bản đồ →POI/link OSM; cấu hình VietMap và thử tuyến A-B →ghé/bỏ điểm, tổng tuyến cập nhật.
5. Audio WAV gửi đến `/api/voice/transcribe` phải có `Authorization: Bearer <Supabase access token>` của thành viên. Thiếu token bị401; không gửi token Cloudflare từ client. Key sai/quota thiếu phải trả lỗi, không tạo transcript/POI giả.

Hiện đã kiểm tra build/typecheck, HTTP contract với fixture, UI fixture, local real-ASR benchmark. Chưa có token Cloudflare/key VietMap/Gemini và URL deployment nên **chưa xác minh production end-to-end**. Public Overpass từng406/timeout trong môi trường này; cần kiểm tra nguồn POI khi deploy.

### Bài kiểm tra cloud có thể chạy lại

Sau khi tạo audio benchmark (script ở VOICE_BENCHMARK.md), chạy:

```sh
node scripts/voice/check-deployment.mjs https://TEN-PROJECT-API.vercel.app/api https://TEN-PROJECT-WEB.vercel.app ~/.cache/imap-voice/audio /tmp/imap-cloud-voice-check.json
```

Bài này yêu cầu biến môi trường `IMAP_TEST_ACCESS_TOKEN` chứa phiên đăng nhập của tài khoản test (không dùng token Cloudflare và không đưa token vào lệnh CLI/log/Git). Thiếu phiên sẽ dừng; API trả401 cho khách. Bài này bắt buộc HTTPS, kiểm tra health/config, CORS web origin rồi gửi 3 WAV tổng hợp đến provider thật. Thiếu config, quota, lỗi phiên âm hoặc response giả dạng sai provider đều exit1; không dùng model local thay thế. Chưa chạy vì chưa có deployment/token. Đây vẫn chưa kiểm tra phần ghi âm micro trên thiết bị. Nghiệm thu thêm Chrome desktop và Safari/Chrome điện thoại: cấp/từ chối quyền, nói/Xong/Hủy, câu mơ hồ, mạng lỗi, kết quả bản nháp, bấm Tìm và POI. Ghi thiết bị/browser/câu nói/độ trễ; không gắn nhãn production đạt chỉ bằng unit test.

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
- [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Cloudflare REST API setup](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)
- [Whisper input/output](https://developers.cloudflare.com/workers-ai/models/whisper/)
- [Hugging Face Spaces requirements](https://huggingface.co/docs/hub/spaces-overview)
