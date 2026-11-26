# Phase 1 — Audit repository (2026-11-26)

Monorepo `RouteTwin_OOP_Starter`: `apps/web` (React 19 + Vite + Tailwind), `apps/api` (Express, TypeScript), `packages/shared`.

## Bản đồ hiển thị

| Hạng mục | Hiện trạng | Tệp |
|---|---|---|
| Map engine | Leaflet 1.9 + MapLibre GL 5 qua `@maplibre/maplibre-gl-leaflet` (vector style chạy trong lớp Leaflet) | `apps/web/src/features/map/services/LeafletMapController.ts` |
| Registry nguồn nền | Mới: `BASEMAP_PROVIDERS`, trạng thái UNVERIFIED/TESTING/APPROVED/REJECTED/BLOCKED | `apps/web/src/features/map/basemap/providers.ts` |
| BasemapManager | `BaseLayers`: chọn nguồn theo registry, dự phòng trong chuỗi, thông báo khi hết nguồn | `.../services/leaflet/BaseLayers.ts` |
| vApp | style.json tải thẳng từ trình duyệt, style gốc không chỉnh | `.../services/leaflet/VappLayer.ts` |
| VIETMAP | style/ô qua proxy API (khóa giữ ở máy chủ) | `.../leaflet/VietmapLayer.ts`, `apps/api/src/modules/map/presentation/vietmapBasemapRouter.ts` |
| VNSDI hành chính/địa hình | ô ArcGIS qua proxy API (token ở máy chủ) | `apps/api/src/modules/map/presentation/vnsdiBasemapRouter.ts` |
| VNSDI Sentinel-2 | ô ArcGIS công khai, tải thẳng | registry `vnsdi-sentinel2` |
| Nhãn chủ quyền iMap | `ArchipelagoLabels`: Hoàng Sa, Trường Sa, Biển Đông, 15 đảo; tự tắt khi nền đã có nhãn | `.../leaflet/ArchipelagoLabels.ts`, `domain/vietnamArchipelagos.ts` |
| Bản đồ phụ (Điều 20.2–20.3) | Mới: `VietnamInset` | `.../leaflet/VietnamInset.ts`, `domain/vietnamTerritory.ts` |
| Tổng quan Việt Nam | Nút "Xem toàn Việt Nam" (menu) → khớp 4°30′–23°30′B, 102°–118°Đ | `.../leaflet/MapCamera.ts`, `app/shell/TopBar.tsx` |
| Chọn lớp | Theo hệ thống / Đường phố / Tối / Vệ tinh / Hành chính; lớp phủ Giao thông, Sự cố, Địa hình | `features/map/components/LayerSwitcher.tsx` |
| CSP | `img-src` có `vnsdi.mae.gov.vn`; `connect-src` có `map.vapp.vn`; không có OSM/Esri. Có test đối chiếu với registry | `apps/web/src/shared/security/contentSecurityPolicy.ts`, `apps/web/vite.config.ts` |

Đã gỡ trong đợt này: ô OpenStreetMap (openstreetmap.de/.fr), OpenTopoMap và Esri khỏi nền bản đồ, preconnect tới Esri/OSM trong `index.html`, link "Mở trên OpenStreetMap", dòng "Bản đồ nền OpenStreetMap".

## Dịch vụ không phải hiển thị

| Chức năng | Nhà cung cấp | Tệp chính | Ghi chú chủ quyền |
|---|---|---|---|
| Định tuyến | VIETMAP Route v4 | `apps/api/src/modules/navigation/infrastructure/providers/VietmapRouteProvider.ts` | Không hiển thị nhãn; giữ nguyên |
| Tính lại tuyến khi lệch | VIETMAP qua `RerouteUseCase` | `.../navigation/application/use-cases/RerouteUseCase.ts`, web `useNavigationRerouting.ts` | Giữ nguyên |
| Tối ưu nhiều điểm | VIETMAP Matrix v4 | `.../optimization/infrastructure/providers/VietmapMatrixProvider.ts` | Giữ nguyên |
| Geocoding, autocomplete, reverse | VIETMAP Autocomplete/Place v4 | `.../places/infrastructure/providers/VietmapPlaceSearchProvider.ts` | Kết quả tìm kiếm cần kiểm thử tên (ROADMAP) |
| Quanh đây / dọc tuyến | VIETMAP POI | `VietmapPoiSearchProvider.ts` | — |
| Trợ lý địa điểm (dừng chân) | **OSM Overpass** (dữ liệu) | `.../route-stops/infrastructure/providers/OverpassStopPlaceProvider.ts` | Dùng dữ liệu OSM, không phải nền; có ghi nguồn ODbL |
| So sánh thuật toán Dijkstra/A* | **Đồ thị OSM** từ file (`npm run osm:import`) | `.../navigation/infrastructure/osm/*` | Chỉ backend/benchmark, UI đã gỡ |
| GPS | `navigator.geolocation` | `features/guidance/services/BrowserGpsSource.ts` | — |
| Giao thông, báo cáo cộng đồng | Supabase (bảng + Realtime) | `SupabaseTrafficReportRepository.ts`, `features/traffic` | — |
| Web Push | `web-push` (VAPID) qua Supabase | `WebPushTrafficAlertNotifier.ts` | — |
| AI | Gemini/Ollama (tùy chọn, mặc định tắt) | `GenerativeRoutePreferenceProvider.ts`, `AiStopIntentParser` | — |

## Phân loại OSM

- **OSM để hiển thị bản đồ:** đã loại bỏ. Nguồn vApp dựng từ dữ liệu OSM/Overture/Wikidata nhưng có lớp chủ quyền riêng; được chủ dự án duyệt có điều kiện ngày 2026-11-26.
- **OSM làm dữ liệu:** Overpass cho trợ lý địa điểm và file đồ thị cho benchmark. Không gây vấn đề hiển thị chủ quyền nên giữ, có ghi nguồn ODbL. Có thể thay Overpass bằng VIETMAP POI, nhưng tốn hạn mức.
