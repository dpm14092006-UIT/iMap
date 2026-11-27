# Kiến trúc & quy tắc OOP

## Dependency Rule

Phụ thuộc chỉ đi **vào trong**; ESLint (`no-restricted-imports` trong `eslint.config.js`) chặn chiều ngược lại.

| Khối | Được import | Không được import |
| --- | --- | --- |
| API `modules/*/presentation` | application, domain, `shared` | infrastructure |
| API `modules/*/application` | domain, port của chính nó, `shared` | infrastructure, presentation, `express` |
| API `modules/*/domain` | `@routetwin/shared`, `shared` | application, infrastructure, presentation, `express` |
| API `modules/*/infrastructure` | port + domain để cài đặt | presentation |
| API `shared` | — | `modules` |
| API `compositionRoot.ts` | mọi implementation | — |
| Web `app` | features, `shared` | — |
| Web `features/*` | feature khác (kiểu, service), `shared` | `app` |
| Web `features/*/domain` | `shared/geo`, kiểu của feature | React, `components`, `hooks`, `api`, `services` |
| Web `features/*/{api,services}` | domain, types, shared | React, components, hooks, app |
| Web `shared` | — | `features`, `app` |

`Controller` không viết SQL và không gọi trực tiếp VietMap. `UseCase` chỉ gọi interface (port). Implementation cụ thể chỉ xuất hiện ở `compositionRoot.ts`.

```mermaid
flowchart TB
  Web[React / Map UI] --> Express[Express Routes + Controllers]
  Express --> UseCase[Application Use Cases]
  UseCase --> Port[Ports / Interfaces]
  Port -.implemented by.-> Vietmap[VietMap Adapter]
  Port -.implemented by.-> DB[Supabase Adapter]
  UseCase --> Domain[Domain: thuật toán, quy tắc]
```

## Chọn class hay hàm

- **Class** khi có trạng thái hoặc vòng đời (`RoutePath` tính sẵn đoạn, `NavigationGuidanceEngine`, `RequestGeneration`, `SignedUrlCache`), khi cài đặt một interface (adapter, repository, strategy) hoặc khi cần tiêm phụ thuộc qua constructor (use case, controller).
- **Hàm thuần** cho phép tính không trạng thái: hình học (`shared/geo`), định dạng (`shared/format`), chuyển đổi DTO (`placeFromPoi`, `toSavedRoute`).
- **Hook** chỉ nối class/hàm với React (state, effect); không chứa thuật toán.
- Không bọc dữ liệu không có hành vi vào class chỉ để "có OOP"; kiểu dữ liệu là `type`.

## Patterns có chủ đích

- **Repository**: `TrafficReportRepository` → `SupabaseTrafficReportRepository`; `SavedRouteRepository` → `LocalStorageSavedRouteRepository` (web).
- **Adapter**: `PlaceSearchProvider` → `VietmapPlaceSearchProvider`; `RouteProvider` → `VietmapRouteProvider`; `TrafficImageAnalyzer` → `GeminiTrafficImageAnalyzer`; `RouteComparisonSnapshots` → `SignedRouteComparison`; `FeatureQuota` → `SupabaseUserFeatureQuota`.
- **Strategy**: `OptimizationStrategy` (`ExactTourStrategy` Held–Karp / `TwoOptStrategy` NN + 2-opt); `ShortestPathSolver` (`DijkstraSolver` / `AStarSolver` trên khung `GraphSearchSolver`).
- **Dependency Injection bằng constructor**, wiring tại `compositionRoot.ts`.
- **DTO + Zod** (`packages/shared/src/schemas`): đầu vào HTTP được kiểm tra ở biên, không phải domain entity.

## Cấu trúc thư mục

```text
apps/api/src/
  app.ts                  # entry Vercel: export default createApp()
  createApp.ts           # factory Express (header, CORS, router, lỗi)
  main.ts                 # chạy local: createApp().listen()
  compositionRoot.ts     # nơi duy nhất biết implementation cụ thể
  config/                 # env đã kiểm tra bằng Zod
  modules/<feature>/
    domain/               # thuật toán, quy tắc thuần (+ port domain sở hữu)
    application/
      ports/              # interface I/O mà use case cần
      use-cases/
    infrastructure/       # adapter VietMap, Supabase, Gemini, OSM…
    presentation/         # controller + router Express
  shared/                 # http, errors, quota (port), supabase, geo, async
apps/web/src/
  app/
    App.tsx               # chỉ lắp ghép bản đồ, panel và các hook điều phối
    flows/                # workspace/, guidance/, traffic/, routes/, explore/
    shell/                # khung ứng dụng, thanh trên, dock
    styles/               # CSS bố cục shell
    lazyPanels.ts types.ts
  features/<feature>/
    components/ hooks/ api/ services/
    domain/               # logic/danh mục thuần; không React hoặc I/O
    types.ts              # model mà feature sở hữu
  shared/
    ui/                   # Button, Input/Select/Textarea, SheetPanel, Popover, Icon
    styles/               # token màu, nền, trạng thái control
    geo/                  # types, distance, polyline: primitive hình học duy nhất
    format/ async/ api/ i18n/ hooks/ text/
packages/shared/src/
  schemas/                # DTO + Zod validation
  geo/ text/              # haversine và xử lý dấu tiếng Việt dùng chung
```

### Model thuộc về đâu (web)

| Kiểu | Chủ sở hữu |
| --- | --- |
| `LatLng`, `Coordinate`, `Bounds` | `shared/geo/types.ts` |
| `RoutePlan`, `RouteLeg`, `TransportMode`, `RouteObjective` | `features/routing/types.ts` |
| `MapLayer`, `DraftStops`, `MapOverlays` | `features/map/types.ts` |
| `Place`, `PlaceSource` | `features/places/types.ts` |
| `IncidentKind`, `TrafficIncident`, `TrafficMapLayer` | `features/traffic/types.ts`, `features/traffic/domain/trafficMapLayer.ts` |
| `FeatureKey` (panel đang mở) | `app/types.ts` |

## Phía web (`apps/web/src`)

| Tầng | Lớp / module | Vai trò |
| --- | --- | --- |
| Truyền tải | `HttpClient`, `ApiError`, `timeoutSignal` | Gọi HTTP duy nhất: bóc phong bì `{ data }`, timeout cả lúc đọc body, lỗi tiếng Việt |
| API client | `PlaceApiClient`, `TrafficApiClient`, `RouteApiClient`, … | Mỗi module backend một client, nhận `HttpClient` qua constructor |
| Lưu trữ | `SavedRouteRepository` ← `LocalStorageSavedRouteRepository`; `recentPlacesStore` | Ẩn nơi lưu; đổi cài đặt không sửa hook |
| Hình học | `shared/geo/distance.ts`, `shared/geo/polyline.ts` | Haversine, xấp xỉ phẳng, hướng, chiếu điểm lên đoạn/đường gấp khúc — mọi feature dùng chung |
| Miền dẫn đường | `RoutePath`, `NavigationGuidanceEngine`, `IncidentAheadDetector`, `SpeedEstimator` | Tiến độ, lệch tuyến, sự cố phía trước; có test, không biết React |
| Bất đồng bộ | `RequestSequence` (theo kênh), `RequestGeneration` (một luồng), `debounce`, `whenIdle` | Bỏ kết quả cũ về muộn, gom tải lại |
| Bản đồ | `MapController` / `MaplibreMapController` | Adapter bọc MapLibre GL; React chỉ gọi method của interface |
| Điều phối | `app/flows/*/use*` | Mỗi hook một luồng nghiệp vụ nhiều feature; `App.tsx` chỉ lắp ghép |

Quy tắc: component không gọi `fetch` hay `localStorage` trực tiếp; hook nhận lớp qua tham số (mặc định là bản dùng chung) để thay bằng bản giả khi test.

## Phía API (`apps/api/src`)

Mỗi module theo `presentation (Controller/Router) → application (UseCase + Port) → domain`, `infrastructure` cài đặt port.
Hạ tầng dùng chung ở `shared/http`: `SessionAuthenticator` (xác thực), `FeatureQuotaGuard` (hạn mức theo người dùng qua port `FeatureQuota`), `ConcurrencyLimiter` (giới hạn song song mỗi instance).
`npm run typecheck` kiểm tra cả mã chạy lẫn test (`tsconfig.test.json`).

## Hợp đồng module UI

N1 không truy cập DB traffic trực tiếp; N2 không sửa `MapView.tsx` trực tiếp. N2 cung cấp `useTrafficReports` và `TrafficReportPanel`; N1 render `TrafficMapLayer` (`features/traffic/domain/trafficMapLayer.ts`) qua interface chung.

## Ghi chú GPS và routing

- Dijkstra/A* là **thuật toán đồ thị riêng** trên OSM một khu vực giới hạn (`/api/routes/pathfinding`), khác kết quả route từ VietMap; được kiểm tra qua API/test/benchmark.
- VietMap Route v4 tính đường theo hình học và hướng dẫn rẽ; VietMap Matrix cấp ma trận chi phí cho tối ưu nhiều điểm.
- Tối ưu ghé nhiều điểm là bài toán TSP path/cycle tùy điểm đầu/cuối, ma trận có thể bất đối xứng: Held–Karp chính xác khi ít điểm, NN + 2-opt khi nhiều điểm (`algorithm: 'auto'`).
- Gemini có thể gợi ý loại sự cố và ghi chú hoặc nội dung biển báo từ ảnh ngay trong form báo cáo. Tính năng mặc định tắt; người dùng phải xem lại và tự gửi, không tự xác nhận sự cố hay sửa tuyến.


## Ranh giới feature và vòng đời web

`routing` sở hữu `RoutePlan`, phương án, chia sẻ và form chỉ đường. `guidance` sở hữu `NavigationStatus`, `RoutePath`, GPS, âm thanh và tiến độ dẫn đường. Các hook nối nhiều feature đặt ở `app/flows`, không import ngược `app` từ feature.

`MaplibreMapController` là Facade điều phối các lớp trong `services/maplibre/`: `MaplibreBasemap`, `MaplibreCamera`, `RouteLayer`, `TrafficLayers`, marker (`PoiMarkers`, `LocationMarker`, `FocusPin`), `VietnamInset`, `Map3D`, `SunLight`. Các lớp sở hữu nhóm layer của mình; `destroy()` gỡ listener và map. Khi không có phương án phụ, tuyến chính vẫn được fit. Chuỗi không tin cậy trong tooltip/popup dùng text node.

Các panel chia form, bộ lọc và kết quả thành component riêng; hook sở hữu state và request. Kết quả tìm kiếm/AI phải bị huỷ khi đổi token, điểm hoặc ảnh. Tối ưu hành trình dùng `RequestGeneration` để kết quả trước reset/đổi tuỳ chọn/unmount không phục hồi dữ liệu cũ.

Công thức haversine ở `packages/shared/src/geo/haversine.ts`; API dùng bán kính trung bình 6.371.008,8 m, wrapper web giữ bán kính lịch sử 6.371.000 m để kết quả hình học không thay đổi. `stripDiacritics` giữ hoa/thường; `foldVietnamese` tạo khoá tìm kiếm viết thường và trim. Không sao chép lại công thức vào feature.

## Giao diện và kiểm tra

Quy ước token và control ở [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). `app/styles.css` chỉ nhập CSS theo phạm vi và các lớp Tailwind; không dùng selector dò chuỗi `class` để ép màu tối.

`npm run verify -- --shuffle=1` chạy format, lint ranh giới, typecheck, audit export/props, unit test API/web/shared, xáo trộn thứ tự và build production. `npm run test:browser` mở Vite riêng và chạy Chromium với MapLibre GL thật trên desktop/mobile, fixture API/tile; không sử dụng provider trả phí. Cài browser bằng `npx playwright install chromium` (Linux CI dùng `--with-deps`). Biến `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` cho phép dùng browser đã có; `IMAP_BROWSER_ARTIFACTS` chỉ định thư mục screenshot tuỳ chọn.

Test browser không thay thế xác minh GPS/âm thanh trên thiết bị, Supabase RLS, provider thật hoặc giao nhận Web Push. Không ghi các giới hạn đó thành kết quả đã đạt.


Chức năng Demo/thuyết trình đã được gỡ theo yêu cầu: không còn GPS mô phỏng, sự cố giả, công tắc nguồn GPS, UI so sánh thuật toán hoặc nhánh `demo` từ URL/localStorage. Dẫn đường chỉ dùng `navigator.geolocation.watchPosition`. Browser test cấp vị trí bằng công cụ kiểm thử cho API geolocation thật; đó không phải mã mô phỏng trong ứng dụng. Backend và benchmark thuật toán dùng cho tính tuyến/tối ưu vẫn độc lập.
