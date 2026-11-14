# WBS – N1: Navigation & Optimization (5 ngày)

> Phạm vi: Website bản đồ + Places + Routing ô tô/xe máy + Dijkstra/A* + TSP (Matrix → NN → 2-opt) + Dynamic Rerouting + My Routes.
> Cách dùng: đánh dấu `[x]` khi đạt **Tiêu chí xong (DoD)**. Ước lượng giờ chỉ để cân tải mỗi ngày (~8h/ngày).

## Hiện trạng (đã có, không tính vào WBS)

- Bản đồ Leaflet/OSM, street/satellite, zoom, định vị GPS
- Tìm địa điểm qua Photon, tính tuyến VietMap Route v4 (1 tuyến, 2+ điểm)
- UI panel: Directions, Multi-stop (chỉ nối theo thứ tự nhập), Saved routes (localStorage)
- `DijkstraSolver` bản O(V²) + test, `NearestNeighborStrategy` + test (chưa gắn endpoint)

## Tổng quan

| Ngày | Chủ đề | Mốc kết thúc ngày |
|---|---|---|
| 1 | Nền tảng, dọn dẹp, Map/Places/Navigation ổn định | Tìm → chọn → chỉ đường car/xe máy chạy mượt, có hook cho TrafficMapLayer |
| 2 | Thuật toán đồ thị: OSM graph, Dijkstra (heap), A* | `/api/routes/algorithm` chạy trên khu vực nhỏ + benchmark |
| 3 | Tối ưu đa điểm: Matrix, NN, 2-opt | `/api/routes/optimize` + Multi-stop UI nhận thứ tự tối ưu |
| 4 | Dynamic Rerouting + My Routes | Mô phỏng đi lệch/đường bị chặn → tính lại; lưu/mở tuyến qua API |
| 5 | Tích hợp, responsive, test, tài liệu, demo | Feature freeze N1, demo end-to-end |

---

## Ngày 1 – Nền tảng & Map / Places / Navigation

| ID | Công việc | Giờ | DoD | ✔ |
|---|---|---|---|---|
| 1.1 | Cấu hình môi trường: `apps/api/.env` với `VIETMAP_API_KEY`, chạy `./run.sh`, kiểm tra `/api/health` báo `vietmap` | 0.5 | Health trả `routing: vietmap`; route thật vẽ được | [x] key OK; sửa provider đọc GeoJSON LineString |
| 1.2 | Thống nhất kiểu dữ liệu: thay `DemoPlace` bằng `Place` (`features/places/types.ts`), dữ liệu gợi ý chuyển sang `places/data/popularPlaces.ts` | 1.5 | Typecheck sạch, không còn phụ thuộc `demoPlaces` ngoài dữ liệu demo | [x] |
| 1.3 | Places: debounce + hủy request cũ (`usePlaceSearch`), giới hạn 7 kết quả, trạng thái loading/empty/lỗi, phím ↑ ↓ Enter Esc | 1.5 | Gõ nhanh không gửi request thừa; lỗi hiện thông báo thân thiện | [x] |
| 1.4 | Chọn điểm bằng **click bản đồ** (`GET /api/places/reverse`) để đặt điểm đi/đến; nút “Vị trí của tôi” làm điểm xuất phát | 1.5 | Click map → điền ô điểm đi/đến; GPS làm origin được | [x] |
| 1.5 | Vehicle switcher car/motorcycle (`useDirections`): đổi xe tự tính lại tuyến; hiển thị distance/duration + bước rẽ có mũi tên | 1.5 | Đổi xe → tuyến mới; bước rẽ hiển thị đúng đơn vị km/phút | [x] đã test thật: xe máy 5,3 km, ô tô 5,7 km |
| 1.6 | Hợp đồng `TrafficMapLayer` (GeoJSON) tại `map/layers/trafficMapLayer.ts`, `MapView` vẽ marker từ hợp đồng — **thống nhất với N2** | 1 | Có interface + marker mẫu hiển thị; N2 review | [x] chờ N2 review |
| 1.7 | Hợp đồng shared (PR chung): `OptimizeRequest/Result`, `SavedRoute` DTO trong `packages/shared` | 0.5 | PR merge sau review N2 | [ ] dời sang ngày 3–4 (làm khi cần dùng) |

**Deliverable D1:** luồng tìm kiếm → chỉ đường 1 xe ổn định, UI không còn hard-code demo.

---

## Ngày 2 – Thuật toán đồ thị (OSM, Dijkstra, A*)

| ID | Công việc | Giờ | DoD | ✔ |
|---|---|---|---|---|
| 2.1 | Script `scripts/osm/import-osm.ts` (`npm run osm:import`): tải OSM trung tâm TP.HCM qua Overpass, lọc đường xe đi được, xuất `apps/api/data/osm/hcmc-center.json` | 2 | File graph sinh được; commit file (~1,4 MB) | [x] 17.368 node, 31.929 cạnh |
| 2.2 | `OsmGraphBuilder` + `osmRoadRules` → `RoadGraph`: distance (haversine), duration (theo loại đường/maxspeed), xe máy/ô tô, một chiều (kể cả `oneway:motorcycle`) | 1.5 | Load graph, xe máy/ô tô lọc cạnh đúng; unit test | [x] |
| 2.3 | `DijkstraSolver` dùng **min-heap** (`MinHeap`) thay vòng quét O(V²); chung khung `GraphSearchSolver` với A* | 1 | Test cũ vẫn pass | [x] bỏ phần so với bản O(V²) |
| 2.4 | `AStarSolver` (heuristic haversine; duration = haversine / tốc độ lớn nhất) | 1.5 | Chi phí **bằng** Dijkstra trên cùng graph; ít node duyệt hơn | [x] 0 cặp lệch, giảm 52–75% node |
| 2.5 | Snap vào mạng đường chính (SCC lớn nhất), `FindPathUseCase`, `POST /api/routes/algorithm`, `GET /api/routes/algorithm/graph`, UI “So sánh thuật toán” | 1.5 | Trả path, distance, visitedNodes, thời gian chạy; 422 nếu ngoài vùng graph | [x] |
| 2.6 | Test + benchmark Dijkstra vs A* (`npm run benchmark:pathfinding`) | 0.5 | Bảng kết quả trong `docs/BENCHMARK_PATHFINDING.md`; test chạy trong `npm test` | [x] |

**Deliverable D2:** API thuật toán chạy được; có số liệu so sánh để đưa vào báo cáo.

---

## Ngày 3 – Tối ưu đa điểm (Matrix → NN → 2-opt)

| ID | Công việc | Giờ | DoD | ✔ |
|---|---|---|---|---|
| 3.1 | `VietmapMatrixProvider implements MatrixProvider` | 2 | Gọi thật được với nhiều điểm | [x] N2 làm; N1 gắn vào port `MatrixProvider` (đã thử thật tới 20 điểm) |
| 3.2 | `TwoOptStrategy` (NN + 2-opt best-improvement) cho ma trận **bất đối xứng**, interface `OptimizationStrategy` chung với Held–Karp | 2 | Test: không tệ hơn NN, giữ điểm đầu/cuối | [x] |
| 3.3 | `OptimizeRouteUseCase`: Matrix → Held–Karp (mặc định) hoặc NN + 2-opt → tuyến thật; báo đích danh điểm không có đường | 1.5 | Trả `order`, chi phí trước/sau, thuật toán đã dùng | [x] N2 làm phần lõi, N1 thêm chọn thuật toán |
| 3.4 | `POST /api/routes/optimize` qua `OptimizationController`, Zod schema (tối đa 15 điểm ghé, `algorithm`) | 0.5 | Validate trước khi gọi Matrix | [x] |
| 3.5 | `MultiStopPanel`: chọn thuật toán, hiển thị “tiết kiệm X% so với thứ tự nhập” | 2 | Thấy thứ tự tối ưu và mức tiết kiệm | [x] N2 làm panel, N1 thêm phần thuật toán |

**Deliverable D3:** Multi-stop tối ưu thật thay cho nối điểm theo thứ tự nhập.

---

## Ngày 4 – Dynamic Rerouting & My Routes

| ID | Công việc | Giờ | DoD | ✔ |
|---|---|---|---|---|
| 4.1 | Phát hiện lệch tuyến: dùng `NavigationGuidanceEngine` của N2; N1 thêm `IncidentAheadDetector` (sự cố trên tuyến trong 1,5 km phía trước) | 1.5 | Unit test sự cố phía trước / đã qua / xa tuyến / chỉ báo 1 lần | [x] |
| 4.2 | `RerouteUseCase` + `POST /api/routes/reroute`: tuyến thay thế VietMap → điểm vòng tránh → báo `unavoidable` | 1.5 | Trả tuyến mới + chiến lược đã dùng | [x] thử thật: chuyển tuyến thay thế khi sự cố giữa tuyến |
| 4.3 | Dẫn đường GPS thật (N2, `useNavigationSession`) + chế độ **Demo** (N1): `PositionSource` → `BrowserGpsSource` / `SimulatedGpsSource`, bật bằng `?demo=1`, đổi Thật ↔ Demo giữa chuyến | 2 | Demo được không cần GPS thật | [x] đã thử: rẽ nhầm → tính lại; sự cố → tuyến thay thế |
| 4.4 | Tránh sự cố thật từ `TrafficMapLayer` của N2 (đang hoạt động, mức Vừa trở lên) khi tính lại tuyến | 0.5 | Reroute gửi danh sách sự cố cần tránh | [x] cần Supabase để thử với dữ liệu thật |
| 4.5 | My Routes lưu lên Supabase | 1.5 | — | [ ] **chuyển cho N2** (theo thống nhất) |
| 4.6 | Frontend My Routes | 1 | — | [ ] **N2 đã có bản localStorage**, bản Supabase do N2 làm |

**Deliverable D4:** Reroute demo được; My Routes đi qua API, chỉ cần cắm auth/Supabase của N2.

---

## Ngày 5 – Tích hợp, QA, Demo

| ID | Công việc | Giờ | DoD | ✔ |
|---|---|---|---|---|
| 5.1 | Tích hợp với N2: đồng bộ `main` sau giao diện mới; đưa lại so sánh Dijkstra/A\* và chọn thuật toán TSP vào **chế độ thuyết trình** (`?demo=1`) | 1.5 | Chạy chung 1 build; giao diện thường không đổi | [x] |
| 5.2 | Responsive: kiểm tra 390 px (khối so sánh, chọn thuật toán, banner Demo) | 1.5 | Không tràn ngang | [x] |
| 5.3 | Rà soát lỗi API của N1: 13 tình huống sai dữ liệu / ngoài vùng / điểm không có đường | 1 | Mã lỗi đúng, thông báo tiếng Việt, không sập | [x] |
| 5.4 | Typecheck, lint, Prettier, build; test API 235/235, web 1001/1001 | 1.5 | CI xanh | [x] |
| 5.5 | Tài liệu: README (chế độ thuyết trình), chạy lại benchmark (số liệu không đổi) | 1 | — | [x] |
| 5.6 | Kịch bản demo 5–7 phút: `docs/DEMO_SCRIPT_N1.md` | 1 | Chạy trót lọt | [x] cần tập thử 2 lần |
| 5.7 | Buffer / sửa lỗi tồn đọng | 0.5 | — | [ ] |

**Deliverable D5:** N1 feature freeze, demo sẵn sàng.

---

## Phụ thuộc & rủi ro

| Rủi ro | Tác động | Giảm thiểu |
|---|---|---|
| N2 chưa xong Auth/Supabase khi tới D4–D5 | My Routes không lưu bền | Dùng port `SavedRouteRepository` + InMemory/localStorage, đổi adapter sau |
| Traffic realtime của N2 chưa có | Reroute thiếu dữ liệu sự cố | Dùng sự cố mẫu theo interface `TrafficMapLayer` |
| VietMap hết quota / key lỗi | Route, Matrix không chạy | Cache kết quả khi demo, ít điểm, ghi rõ giới hạn |
| Overpass chậm / graph quá lớn | D2 trượt | Chọn khu vực nhỏ, commit sẵn file graph đã lọc |
| Sửa `packages/shared`, `composition-root.ts` | Xung đột với N2 | Mở PR sớm D1, N2 review trước khi dựng tiếp |

## Theo dõi tiến độ

| Ngày | Tổng task | Xong | Ghi chú |
|---|---|---|---|
| 1 | 7 | 6 | 1.7 dời sang D3–D4 |
| 2 | 6 | 6 | Thêm UI so sánh thuật toán (không cần key VietMap) |
| 3 | 5 | 5 | N2 làm lõi Held–Karp; N1 thêm 2-opt, Strategy, benchmark (`docs/BENCHMARK_TSP.md`) |
| 4 | 6 | 4 | Rerouting tránh sự cố gắn vào dẫn đường GPS của N2; My Routes chuyển cho N2 |
| 5 | 7 | 6 | 5.7 (buffer) dùng khi tập demo |
