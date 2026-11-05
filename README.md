# iMap

> Project vision: A Web-Based Navigation and Route Optimization System with Real-Time Community Traffic Updates.

Bộ ứng dụng React/TypeScript + Tailwind CSS + Express/TypeScript theo hướng feature-first và Clean Architecture. Web dùng nền bản đồ OpenStreetMap, tìm địa điểm qua Photon và tính tuyến ô tô/xe máy qua VietMap Route API v4. N2 có Auth, báo cáo giao thông PostGIS, GeoJSON/Realtime, xác minh cộng đồng và ảnh hiện trường lưu riêng tư. Các báo cáo cùng loại trong bán kính 75 m và 30 phút được tổng hợp để hiện số báo cáo, người gửi riêng biệt và lần cập nhật gần nhất; đây là ước lượng lân cận, chưa map-match vào cùng đoạn đường.

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

> Tạo `apps/api/.env` từ `.env.example` và `apps/web/.env` từ `.env.example`. Điền `SUPABASE_URL` và `SUPABASE_PUBLISHABLE_KEY` ở cả hai phía; thêm `VIETMAP_API_KEY` ở API để tính tuyến. Chạy đủ migration `0001`–`0004` trước khi dùng báo cáo. Ảnh báo cáo được tải trực tiếp lên bucket riêng tư theo quyền người dùng. Hỗ trợ Gemini trong biểu mẫu báo cáo là tùy chọn, mặc định tắt; chỉ bật sau khi cấu hình `GEMINI_API_KEY` và `GEMINI_TRAFFIC_AI_ENABLED=true`. **Không commit `.env`**.

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
| `POST /api/traffic-reports/analyze-image?task=incident\|traffic_sign` | N2 | Gợi ý Gemini trong biểu mẫu báo cáo; cần đăng nhập và bật cấu hình |
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
5. **N2 cần cấu hình trước khi chạy thật:** áp dụng migrations `0001_initial.sql`–`0004_community_traffic_confirmations.sql`, bật job hết hạn trong `supabase/ops/traffic-expiry-cron.sql`, rồi điền Supabase keys. Ảnh hiện trường là tùy chọn và được gắn trực tiếp vào báo cáo giao thông.
6. AI ảnh (gợi ý sự cố và đọc biển báo) nằm ngay trong Báo cáo giao thông, không có mục AI Vision riêng; cần bật Gemini riêng. Xem [docs/AI_APPLICATIONS.md](docs/AI_APPLICATIONS.md) về giới hạn và quyền riêng tư.

Xem `docs/ARCHITECTURE.md`, `docs/OWNERSHIP.md`, `docs/ROADMAP_2_WEEKS.md`.
