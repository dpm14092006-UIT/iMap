# iMap

> Project vision: A Web-Based Navigation and Route Optimization System with Real-Time Community Traffic Updates.

Bộ ứng dụng React/TypeScript + Tailwind CSS + Express/TypeScript theo hướng feature-first và Clean Architecture. Web dùng nền bản đồ OpenStreetMap, tìm địa điểm qua Photon và tính tuyến ô tô/xe máy qua VietMap Route API v4. N2 có Auth, báo cáo giao thông PostGIS, GeoJSON/Realtime, xác minh cộng đồng và ảnh hiện trường lưu riêng tư cùng báo cáo.

Tuyến được dựng từ hình học đường và hướng dẫn rẽ trả về từ VietMap, không còn nối thẳng các điểm mẫu. Cần có `VIETMAP_API_KEY` để tính tuyến; khi thiếu key, API trả lỗi cấu hình thay vì vẽ tuyến giả.

## Chạy trên Mac (Node >= 20.19)

```bash
unzip RouteTwin_OOP_Starter.zip
cd RouteTwin_OOP_Starter
chmod +x run.sh
./run.sh
```

Lần đầu `run.sh` chạy `npm install`, cần Internet. Sau đó mở `http://localhost:5173`. API `http://localhost:4000/api/health`. Có thể chạy riêng:

```bash
npm install
npm run dev -w @routetwin/api
npm run dev -w @routetwin/web
```

> Tạo `apps/api/.env` từ `.env.example` và `apps/web/.env` từ `.env.example`. Điền `SUPABASE_URL` và `SUPABASE_PUBLISHABLE_KEY` ở cả hai phía; thêm `VIETMAP_API_KEY` ở API để tính tuyến. Ảnh báo cáo được tải trực tiếp lên bucket riêng tư theo quyền người dùng. Chạy các migration Supabase trước khi dùng; **không commit `.env`**.

## Kiểm tra

```bash
npm run typecheck
npm test
npm run build
curl http://localhost:4000/api/health
```

## Phân vai

- **N1 – Navigation & Optimization**: `apps/web/src/features/map|places|navigation|multi-stop|my-routes`, `apps/api/src/modules/places|navigation|optimization|my-routes`, thuật toán và graph OSM. Sở hữu `MapView`.
- **N2 – Traffic & Data**: `apps/web/src/features/traffic|auth`, `apps/api/src/modules/traffic|auth`, `supabase/`, API middleware, migrations/RLS/Realtime.
- **Cả hai**: `packages/shared`, `.github`, `docs/`, `apps/api/src/composition-root.ts` và hợp đồng `TrafficMapLayer`. Mọi thay đổi shared phải qua PR review.

## Cấu trúc OOP

Backend **feature-first + Clean Architecture**:

- **domain**: entities, value objects, invariant; **không** import Express, Supabase hoặc SDK.
- **application**: use cases, port (interface) cho repositories/providers; chỉ phụ thuộc domain/ports.
- **infrastructure**: triển khai ports bằng Vietmap, OSM và Supabase.
- **presentation**: Express controller/route + schema validation.
- **composition-root.ts**: nơi tạo object và inject dependencies vào constructor.

Đường đi request: `Route -> Controller -> UseCase -> Interface (port) -> Adapter`. Domain không biết API key, HTTP hay SQL.

Frontend React dùng **function components + hooks**, không gượng ép OOP class cho UI. OOP đặt ở service/domain backend.

Frontend chia theo feature (`map`, `places`, `navigation`, `multi-stop`, `my-routes`, `traffic`, `auth`) để thành phần giao diện và hành vi ở gần nhau. `app/` giữ composition/layout; `shared/` chỉ chứa thành phần dùng chung như icon và API client. Tailwind phụ trách bố cục và trạng thái responsive; CSS riêng giữ phần minh họa bản đồ SVG và quy tắc truy cập toàn cục.

## API scaffold

| Endpoint | Chủ | Trạng thái |
|---|---|---|
| `GET /api/health` | Shared | Chạy được |
| `GET /api/traffic-reports` | N2 | Supabase RPC, lọc bounding box |
| `GET /api/traffic-reports/geojson` | N2 | GeoJSON FeatureCollection |
| `POST /api/traffic-reports` | N2 | JWT + PostGIS, rate limit |
| `POST /api/traffic-reports/:id/clearance` | N2 | Xác minh cộng đồng + cooldown |
| `GET /api/places/suggest` | N1 | Photon / OpenStreetMap |
| `POST /api/routes/calculate` | N1 | VietMap Route v4; cần `VIETMAP_API_KEY` |
| `POST /api/routes/algorithm` | N1 | 501, chưa OSM import |
| `POST /api/routes/optimize` | N1 | 501, chưa Matrix/TSP |
| `GET /api/my-routes` | N1 | 501, chưa Supabase |

## Những lưu ý bắt buộc

1. **Đơn vị nội bộ:** mét, giây, m/s; frontend chuyển sang km, phút/giờ và km/h.
2. **Tọa độ JSON:** `{lat,lng}`; GeoJSON `[lng,lat]`.
3. **Bản đồ và chỉ đường:** tile nền OpenStreetMap; tuyến ô tô/xe máy từ VietMap Route v4. API key chỉ nằm trong backend.
4. **Backend giữ khóa bí mật:** khóa VietMap và provider server-side không đi vào `VITE_*`.
5. **N2 cần cấu hình trước khi chạy thật:** áp dụng migrations `0001_initial.sql`, `0002_n2_traffic_auth_ai.sql`, `0003_traffic_report_photos.sql`, bật job hết hạn trong `supabase/ops/traffic-expiry-cron.sql`, rồi điền Supabase keys. Ảnh hiện trường là tuỳ chọn và được gắn trực tiếp vào báo cáo giao thông.
6. **P1 không có trong scope code hiện tại:** nhận diện biển báo liên tục bằng camera; tile server/bản đồ nền toàn quốc.

Xem `docs/ARCHITECTURE.md`, `docs/OWNERSHIP.md`, `docs/ROADMAP_2_WEEKS.md`.

## Trợ lý địa điểm và voice (nhánh dpm)

Tìm nhu cầu chung quanh vị trí hoặc dọc tuyến, hỏi lại khi mơ hồ, thêm/bỏ điểm ghé theo chi phí đường đi thật. Voice trình duyệt và Whisper API là cách điền bản nháp để người dùng kiểm tra trước khi tìm.

- [Thiết kế/API và phạm vi](docs/PLACE_ASSISTANT_TECHNICAL.md)
- [Thuật toán tìm điểm ghé](docs/ROUTE_STOPS_TECHNICAL.md)
- [Benchmark Whisper trên 48 audio](docs/VOICE_BENCHMARK.md)
- [Deploy web + API Vercel, cấu hình voice free quota](docs/DEPLOY_API.md)
