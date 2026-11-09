# iMap

> Project vision: An AI-Enhanced Web-Based Navigation and Route Optimization System with Real-Time Traffic Updates.

Bộ khung React/TypeScript + Tailwind CSS + Express/TypeScript theo hướng feature-first và Clean Architecture. Web dùng nền bản đồ OpenStreetMap, tìm địa điểm qua Photon và tính tuyến ô tô/xe máy qua VietMap Route API v4. Báo cáo giao thông hiện lưu trong RAM; xác thực, Supabase/PostGIS và phân tích ảnh AI chưa được tích hợp.

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

> Tạo `apps/api/.env` từ `.env.example`, rồi thêm `VIETMAP_API_KEY` để bật chỉ đường thật. Giữ key ở máy chủ, không đặt vào `VITE_*`. **Không commit `.env`**.

## Kiểm tra

```bash
npm run typecheck
npm test
npm run build
curl http://localhost:4000/api/health
```

## Phân vai

- **N1 – Navigation & Optimization**: `apps/web/src/features/map|places|navigation|multi-stop|my-routes`, `apps/api/src/modules/places|navigation|optimization|my-routes`, thuật toán và graph OSM. Sở hữu `MapView`.
- **N2 – Traffic, AI & Data**: `apps/web/src/features/traffic|ai-vision|auth`, `apps/api/src/modules/traffic|ai-vision|auth`, `supabase/`, API middleware, migrations/RLS/Realtime.
- **Cả hai**: `packages/shared`, `.github`, `docs/`, `apps/api/src/composition-root.ts` và hợp đồng `TrafficMapLayer`. Mọi thay đổi shared phải qua PR review.

## Cấu trúc OOP

Backend **feature-first + Clean Architecture**:

- **domain**: entities, value objects, invariant; **không** import Express, Supabase hoặc SDK.
- **application**: use cases, port (interface) cho repositories/providers; chỉ phụ thuộc domain/ports.
- **infrastructure**: triển khai ports bằng Vietmap, OSM, Supabase, Gemini.
- **presentation**: Express controller/route + schema validation.
- **composition-root.ts**: nơi tạo object và inject dependencies vào constructor.

Đường đi request: `Route -> Controller -> UseCase -> Interface (port) -> Adapter`. Domain không biết API key, HTTP hay SQL.

Frontend React dùng **function components + hooks**, không gượng ép OOP class cho UI. OOP đặt ở service/domain backend.

Frontend chia theo feature (`map`, `places`, `navigation`, `multi-stop`, `my-routes`, `traffic`, `ai-vision`) để thành phần giao diện và hành vi ở gần nhau. `app/` giữ composition/layout; `shared/` chỉ chứa thành phần dùng chung như icon và API client. Tailwind phụ trách bố cục và trạng thái responsive; CSS riêng giữ phần minh họa bản đồ SVG và quy tắc truy cập toàn cục.

## API scaffold

| Endpoint | Chủ | Trạng thái |
|---|---|---|
| `GET /api/health` | Shared | Chạy được |
| `GET /api/traffic-reports` | N2 | RAM demo |
| `POST /api/traffic-reports` | N2 | RAM demo, chưa auth/realtime |
| `POST /api/traffic-reports/:id/clearance` | N2 | RAM demo |
| `GET /api/places/suggest` | N1 | Photon / OpenStreetMap |
| `GET /api/places/reverse` | N1 | Photon reverse geocoding (tọa độ → địa chỉ) |
| `POST /api/routes/calculate` | N1 | VietMap Route v4; cần `VIETMAP_API_KEY` |
| `POST /api/routes/algorithm` | N1 | Dijkstra / A* trên đồ thị OSM trung tâm TP.HCM |
| `GET /api/routes/algorithm/graph` | N1 | Vùng phủ + kích thước đồ thị OSM |
| `POST /api/routes/optimize` | N1 | 501, chưa Matrix/TSP |
| `GET /api/my-routes` | N1 | 501, chưa Supabase |
| `POST /api/ai/analyze-traffic` | N2 | 501, chưa Gemini |
| `POST /api/ai/recognize-sign` | N2 | 501, chưa Gemini |

## Những lưu ý bắt buộc

1. **Đơn vị nội bộ:** mét, giây, m/s; frontend chuyển sang km, phút/giờ và km/h.
2. **Tọa độ JSON:** `{lat,lng}`; GeoJSON `[lng,lat]`.
3. **Bản đồ và chỉ đường:** tile nền OpenStreetMap; tuyến ô tô/xe máy từ VietMap Route v4. API key chỉ nằm trong backend.
4. **Backend giữ khóa bí mật:** Gemini và các provider server-side không đi vào `VITE_*`.
5. **Cảnh báo demo:** không lưu bền, không realtime, không xác thực. Không deploy public trước khi có JWT/RLS/rate limit/Storage.
6. **P1 không có trong scope code hiện tại:** nhận diện biển báo liên tục bằng camera; tile server/bản đồ nền toàn quốc.

Xem `docs/ARCHITECTURE.md`, `docs/OWNERSHIP.md`, `docs/ROADMAP_2_WEEKS.md`.
