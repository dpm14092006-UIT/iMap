# Kiến trúc & quy tắc OOP

## Dependency Rule

`presentation -> application -> domain`

`infrastructure -> application ports + domain`

`composition-root -> mọi implementation`

Không import ngược chiều. `Controller` không viết SQL và không gọi trực tiếp Vietmap. `UseCase` chỉ gọi interface. `Entity` giữ dữ liệu hợp lệ và phương thức nghiệp vụ.

```mermaid
flowchart TB
  Web[React / Map UI] --> Express[Express Routes + Controllers]
  Express --> UseCase[Application Use Cases]
  UseCase --> Port[Ports / Interfaces]
  Port -.implemented by.-> Vietmap[Vietmap Adapter]
  Port -.implemented by.-> DB[Supabase Adapter]
  UseCase --> Domain[Domain Entities / Value Objects]
```

## Patterns có chủ đích

- **Repository**: `TrafficReportRepository` → `SupabaseTrafficReportRepository` trong composition production.
- **Adapter**: `PlaceSearchProvider` → `PhotonPlaceSearchProvider`; `RouteProvider` → `VietmapRouteProvider`; `TrafficReportRepository` → `SupabaseTrafficReportRepository`; `TrafficImageAnalyzer` → `GeminiTrafficImageAnalyzer`.
- **Strategy**: `OptimizationStrategy` để thay `ExactTourStrategy` (Held–Karp) / `TwoOptStrategy` (NN + 2-opt); `ShortestPathSolver` để thay Dijkstra/A*.
- **Dependency Injection bằng constructor**: `new CreateTrafficReportUseCase(repo)`; wiring tại `composition-root.ts`.
- **DTO + Zod**: đầu vào HTTP không phải domain entity.

## Cấu trúc OOP phía web (`apps/web/src`)

Web dùng React nên giao diện là hàm component; **toàn bộ logic không thuộc giao diện nằm trong lớp** với trách nhiệm đơn:

| Tầng | Lớp | Vai trò |
| --- | --- | --- |
| Truyền tải | `HttpClient`, `ApiError` | Gọi HTTP duy nhất: bóc phong bì `{ data }`, timeout, lỗi tiếng Việt |
| API client | `PlaceApiClient`, `TrafficApiClient`, `PathfindingApiClient`, `AssistantApiClient`, `RouteApiClient` | Mỗi module backend một client, nhận `HttpClient` qua constructor |
| Lưu trữ | `SavedRouteRepository` (interface) ← `LocalStorageSavedRouteRepository`; `TrafficPhotoStorage` | Ẩn nơi lưu; đổi cài đặt không sửa hook |
| Miền dẫn đường | `Geodesy`, `RoutePath`, `NavigationGuidanceEngine` | Toán khoảng cách/tiến độ/lệch tuyến, có test, không biết React |
| Bản đồ | `LeafletMapController` | Adapter bọc Leaflet; React chỉ gọi method public |
| Giọng nói | `SpeechDraftSession` | Phiên nhận dạng giọng nói của trình duyệt |
| Giao diện | `ErrorBoundary` + component/hook | Hook chỉ nối lớp với React (state, effect) |

Quy tắc: component không gọi `fetch` hay `localStorage` trực tiếp; hook nhận lớp qua tham số (mặc định là bản dùng chung) để thay bằng bản giả khi test.

## Cấu trúc OOP phía API (`apps/api/src`)

Mỗi module theo `presentation (Controller/Router) → application (UseCase + Port) → domain → infrastructure (Adapter)`.
Hạ tầng dùng chung ở `shared/http`: `SessionAuthenticator` (xác thực), `FeatureQuotaGuard` (hạn mức theo người dùng),
`ConcurrencyLimiter` (giới hạn song song mỗi instance); `CloudflareWhisperTranscriber` đóng gói nhà cung cấp giọng nói.

## Hợp đồng module UI

N1 không truy cập DB traffic trực tiếp; N2 không sửa `MapView.tsx` trực tiếp. N2 cung cấp `useTrafficReports` và `TrafficReportPanel`; N1 render `TrafficMapLayer` qua interface chung.

## Ghi chú GPS và routing

- Dijkstra/A* là **thuật toán đồ thị riêng** trên OSM một khu vực giới hạn, khác kết quả route từ Vietmap.
- VietMap Route v4 đã dùng để tính đường theo hình học và hướng dẫn rẽ trả về. Matrix/TSP và OSM A* vẫn là phần cần triển khai.
- Tối ưu ghé nhiều điểm với thời gian đi đường là bài toán TSP path/cycle tùy điểm đầu/cuối; ma trận có thể bất đối xứng.
- Gemini có thể gợi ý loại/mức độ sự cố hoặc nội dung biển báo từ ảnh ngay trong form báo cáo. Tính năng mặc định tắt; người dùng phải xem lại và tự gửi, không tự xác nhận sự cố hay sửa tuyến.
