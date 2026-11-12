# Kế hoạch làm lại giao diện web iMap (React + Tailwind)

Mục tiêu: giao diện bản đồ gọn, dễ dùng, trực quan, **đủ tính năng như Google Maps** (khám phá khu vực, lớp bản đồ, giao thông trực tiếp, chỉ đường nhiều phương án, tìm dọc tuyến) nhưng **có bản sắc riêng**, không sao chép Google Maps. Giữ nguyên toàn bộ logic hiện có (chỉ đường VietMap, nhiều điểm, báo cáo giao thông, trợ lý, đã lưu, đăng nhập, dẫn đường GPS).

Phạm vi: chỉ `apps/web`. Không đổi API, shared, supabase. Không thêm thư viện UI lớn (không MUI/AntD/shadcn); chỉ React 19 + Tailwind 3 + Leaflet đang có.

## 1. Hướng thiết kế ("phá cách" so với Google Maps)

| Google Maps | iMap mới |
|---|---|
| Ô tìm kiếm trắng + hàng chip ngang trên cùng | **Dock dọc bên trái** (rail 64px, icon + nhãn nhỏ) cho các chức năng chính; ô tìm kiếm dạng "command bar" bo tròn lớn, có phím tắt `/` và `⌘K` |
| Xanh Google `#1a73e8` | Bảng màu riêng: **indigo đậm `#4338ca` → teal `#0d9488`** (gradient cho nút chính, tuyến chọn), nền panel kính mờ (`bg-white/85 backdrop-blur-xl`), viền `ring-1 ring-black/5` |
| Card "This area" tĩnh | **Widget "Khu vực này"** thu gọn được: nhiệt độ + icon thời tiết, chỉ số giao thông dạng thanh 3 nấc, số sự cố đang báo |
| Nút Layers vuông góc dưới trái | **Bộ chọn lớp dạng pop-over thẻ ảnh** (Bản đồ / Vệ tinh / Tối) + công tắc lớp phủ (Giao thông, Sự cố, Địa hình) |
| Thanh "Live traffic Fast→Slow" | **Chú giải giao thông dạng viên thuốc** đáy giữa: 4 vạch màu + công tắc, chỉ hiện khi lớp Giao thông bật |
| Danh sách tuyến thường | **Thẻ tuyến có dải màu bên trái** trùng màu đường trên bản đồ, nhãn "Nhanh nhất / Ngắn nhất / Ít trạm thu phí", mini‑timeline thời gian |
| Callout giờ/km trắng trên bản đồ | **Nhãn tuyến dạng tag** trên bản đồ: tuyến chọn nền gradient chữ trắng, tuyến phụ nền trắng; click nhãn = chọn tuyến |

Nguyên tắc chung:
- Font Inter (đã có). Cỡ chữ tối thiểu 12px cho nội dung, 11px cho nhãn phụ. Không dùng `text-[9px]/[10px]` cho nội dung chính.
- Bo góc: panel `rounded-3xl`, nút `rounded-2xl`, chip `rounded-full`. Bóng `shadow-float` (giữ token cũ, thêm `shadow-glass`).
- **Dark mode tự động theo giờ: 18:00 → 06:00 sáng hôm sau** (giờ máy người dùng), trên **mọi kích thước màn hình** (không chỉ mobile). Dùng `useTimeBasedMapLayer` sẵn có (`scheduledMapLayer`, hẹn giờ đổi đúng lúc 18:00/06:00, đồng bộ lại khi focus/visibilitychange), bỏ điều kiện chỉ-mobile. Tailwind `darkMode: 'class'`, gắn class `dark` lên `<main>` khi đang trong khung giờ tối — cả giao diện (panel, dock, chip) lẫn nền bản đồ đều chuyển tối. Khi chọn Vệ tinh thì nền là ảnh vệ tinh nhưng giao diện vẫn theo giờ. Không dùng `prefers-color-scheme`. LayerSwitcher chỉ có 2 nền **Bản đồ / Vệ tinh** và một dòng trạng thái "Chế độ tối tự động 18:00–06:00" (không có nút chọn Tối thủ công).
- Chuyển động nhẹ: panel trượt vào 180ms, chip active scale; tôn trọng `prefers-reduced-motion`.
- Truy cập: mọi nút icon có `aria-label`, focus ring rõ, Esc đóng popover/panel, điều hướng bàn phím trong danh sách kết quả.
- Responsive: ≥1024px dock dọc + panel 400px bên trái; 768–1023px dock dọc thu nhỏ (chỉ icon); <768px dock thành **thanh tab đáy**, panel thành **bottom sheet kéo được** (3 nấc: thu 96px / nửa 50dvh / đầy 92dvh).

## 2. Design tokens (tailwind.config.js)

Thêm vào `theme.extend`:
- `colors.brand` đổi sang thang indigo (50 `#eef2ff` … 600 `#4f46e5`, 700 `#4338ca`, 800 `#3730a3`), thêm `colors.accent` thang teal (500 `#14b8a6`, 600 `#0d9488`), giữ `ink` nhưng thêm `ink-soft #475569`.
- `colors.traffic`: `fast #22c55e`, `moderate #facc15`, `slow #ef4444`, `jam #991b1b` (dùng chung cho chú giải, thanh khu vực, đường).
- `backgroundImage.brand-gradient: linear-gradient(135deg,#4338ca 0%,#0d9488 100%)`.
- `boxShadow.glass`, `keyframes/animation`: `sheet-in`, `fade-in`, `pop`.
- `darkMode: 'class'`.

Đổi brand xong phải rà các chỗ đang dùng `brand-*` để vẫn hợp (đa số tự đổi theo token).

## 3. Kiến trúc thành phần mới

Tạo trong `apps/web/src/app/` và các feature tương ứng:

```
app/
  App.tsx                      (giữ logic; JSX gọn lại, ghép các shell component bên dưới)
  layout/
    AppShell.tsx               khung: map nền + vùng overlay, đặt class dark
    SideDock.tsx               thay FeatureNav: rail dọc desktop / tab bar đáy mobile
    TopBar.tsx                 command search + chip danh mục + avatar/cập nhật
    SheetPanel.tsx             thay FloatingPanel: panel trái desktop, bottom sheet kéo được mobile
    Popover.tsx                popover dùng chung (click ngoài/Esc đóng)
  components/FloatingPanel.tsx giữ lại làm wrapper gọi SheetPanel để các panel cũ không vỡ
features/
  explore/                     MỚI – khám phá quanh đây
    components/CategoryChips.tsx      Nhà hàng, Cà phê, Khách sạn, Điểm tham quan, Bảo tàng, Trạm xe buýt, Nhà thuốc, ATM, Xăng, Sạc EV
    components/AreaInsightCard.tsx    "Khu vực này": thời tiết + giao thông + sự cố
    components/PoiResultsPanel.tsx    danh sách kết quả (dùng chung cho quanh đây và dọc tuyến)
    components/PoiCard.tsx            ảnh, tên, sao + số đánh giá, hạng, tiện ích, giá, nút hành động
    components/PoiFilters.tsx         Đánh giá, Tiện ích, Hạng KS, Mức giá, Đang mở cửa, "Tất cả bộ lọc"
    data/poiCatalog.ts                dữ liệu mẫu (xem §5)
    services/mockPoiProvider.ts       sinh POI quanh 1 điểm hoặc dọc 1 polyline (deterministic theo seed)
    services/areaInsight.ts           tính trạng thái giao thông khu vực từ incidents + giờ trong ngày; thời tiết mẫu
    hooks/usePoiSearch.ts
    types.ts                          Poi, PoiCategory, PoiFilters
  map/components/
    LayerSwitcher.tsx          thay phần chọn lớp trong MapToolbar: nút thẻ ảnh + popover
    TrafficLegend.tsx          chú giải Nhanh→Chậm + công tắc
    MapControls.tsx            locate, zoom +/-, la bàn/“xem toàn VN”, thước tỉ lệ (dùng L.control.scale)
  navigation/components/
    RoutePanel.tsx             làm lại bố cục (giữ props/hook useDirections)
    TravelModeTabs.tsx         Tốt nhất · Xe máy · Ô tô · Buýt · Đi bộ · Xe đạp (mode chưa hỗ trợ: disabled + "—")
    RouteOptionCard.tsx        thẻ tuyến: dải màu, thời gian (màu theo tắc), km, nhãn, cảnh báo thu phí/phà, Chi tiết/Xem trước
    DepartureSelect.tsx        Đi ngay / Khởi hành lúc / Đến lúc (chỉ UI + hiển thị giờ đến dự kiến)
    RouteShareBar.tsx          Sao chép liên kết, Chia sẻ (navigator.share), Gửi tới điện thoại (hiện link + hướng dẫn)
    AlongRouteSearch.tsx       ô "Tìm dọc tuyến…" + chip Xăng, Sạc EV, Ăn uống, Cà phê, Khách sạn
```

Không xóa feature cũ; component cũ không còn dùng thì xóa hẳn file và import (không để code chết).

## 4. Màn hình & hành vi chi tiết

### 4.1 Màn hình chính (chưa mở panel)
- TopBar trái: logo iMap (gradient) + command search (PlaceSearchBar hiện có, đổi skin). Bên phải: nút cập nhật (nếu có), avatar.
- Hàng **CategoryChips** ngay dưới search, cuộn ngang, có nút mũi tên trái/phải trên desktop khi tràn. Mỗi chip: icon màu riêng trong vòng tròn nhỏ + nhãn.
- **AreaInsightCard** dưới chip (desktop: trái, dưới search; mobile: thu gọn thành 1 viên thuốc trên tab bar). Nội dung: "Khu vực này · 31°C ☁", dòng giao thông "Giao thông vừa phải · chậm hơn thường lệ ~13 phút" với chấm màu, số sự cố. Có nút mũi tên → mở panel Giao thông. Nút ✕ thu gọn (nhớ trạng thái bằng localStorage, có try/catch).
- Góc dưới trái: **LayerSwitcher** (thẻ 64×64 xem trước lớp kế tiếp, nhãn "Lớp"). Mở popover: 3 thẻ nền (Bản đồ, Vệ tinh, Tối) + 3 công tắc lớp phủ (Giao thông trực tiếp, Sự cố cộng đồng, Địa hình). "Địa hình" dùng tile OpenTopoMap nếu thêm được vào LeafletMapController; nếu không thì bỏ công tắc này.
- Dưới giữa: **TrafficLegend** khi lớp giao thông bật.
- Dưới phải: **MapControls** (định vị, +, −, xem toàn VN) + thước tỉ lệ.

### 4.2 Khám phá quanh đây (chip danh mục)
- Bấm chip → chip active, mở `PoiResultsPanel` ("Nhà hàng quanh đây"), đặt marker POI lên bản đồ (icon theo danh mục, marker nổi bật khi hover thẻ). Bấm lại chip / ✕ để tắt.
- Thanh lọc trong panel: Sắp xếp (Liên quan, Đánh giá, Khoảng cách, Giá), Đánh giá (≥3.5/4/4.5), Đang mở cửa, Mức giá; riêng Khách sạn: ngày nhận/trả (mặc định hôm nay/mai), số khách, Hạng sao, Tiện ích.
- Checkbox "Cập nhật kết quả khi di chuyển bản đồ" ở chân panel.
- PoiCard: ảnh 96px (ảnh thật nếu có, lỗi thì fallback gradient + icon danh mục), tên, sao + số đánh giá, loại/hạng, 2–3 tiện ích (Wi‑Fi, Đỗ xe, Điều hòa…), giá dạng badge "₫210K", khoảng cách. Hành động: **Chỉ đường** (mở RoutePanel với điểm đến = POI), **Lưu**, và khi có tuyến: **Thêm điểm dừng**.
- Bấm thẻ → bay tới POI + mở PlacePanel (đã có) với thông tin POI.

### 4.3 Chỉ đường (RoutePanel làm lại)
- Đầu panel: **TravelModeTabs** – mỗi tab có icon + thời gian ước tính bên dưới (lấy từ kết quả đã tính cho car/motorcycle; mode chưa hỗ trợ hiện "—" và disabled với tooltip "Sắp có").
- Khối điểm: điểm đi (chấm rỗng) / điểm đến (ghim đỏ) nối bằng đường chấm dọc, nút **đổi chiều** ⇅ bên phải, "**+ Thêm điểm đến**" bên dưới (chuyển sang luồng nhiều điểm, mang theo điểm đi/đến hiện tại – xem §6), các nút phụ hiện có: Vị trí của tôi, Chọn trên bản đồ.
- Hàng: **DepartureSelect** bên trái, nút **Tùy chọn** bên phải (popover: Nhanh nhất/Ngắn nhất = objective; Tránh phà = avoidFerry; đây là các tùy chọn API thật hỗ trợ).
- **RouteShareBar**: "Gửi tới điện thoại" + "Sao chép liên kết". Liên kết mã hóa `?from=lat,lng,name&to=lat,lng,name&mode=car` vào URL; khi tải trang có tham số này thì tự điền và tính tuyến.
- Danh sách **RouteOptionCard** cho `directions.routeOptions`: tuyến đầu gắn nhãn "Nhanh nhất", thời gian màu xanh/vàng/đỏ theo mức sự cố trên tuyến (dùng `routeTraffic`), dòng mô tả "qua <tên đường chính>" nếu có từ instructions, cảnh báo ⚠ "Tuyến có thu phí (~xx₫)" khi `tollCostVnd > 0`. Nút **Chi tiết** mở InstructionList (đã có) dạng mở rộng tại chỗ; **Xem trước** fit bản đồ vào tuyến. Nút chính "Bắt đầu" (gradient) và "Lưu".
- Giữ AlgorithmComparison nhưng thu vào mục "Nâng cao: so sánh Dijkstra / A*" có thể mở rộng.
- Trên bản đồ: tuyến chọn màu gradient indigo→teal (hoặc indigo đậm nếu Leaflet không hỗ trợ gradient), tuyến phụ xám‑tím nhạt; **nhãn tuyến** tại trung điểm mỗi tuyến hiện "🚗 2 giờ 9 phút · 101 km"; click nhãn hoặc đường = `directions.selectRoute(id)` (dùng hàm chọn tuyến sẵn có trong hook).

### 4.4 Tìm dọc tuyến
- Khi đã có tuyến: thanh nổi phía trên bản đồ (vị trí thay cho CategoryChips) gồm ô "Tìm dọc tuyến…" + chip Xăng, Sạc EV, Ăn uống, Cà phê, Khách sạn.
- Chọn → `PoiResultsPanel` tiêu đề "Khách sạn dọc tuyến", nút ← quay lại panel chỉ đường; POI sinh dọc polyline tuyến đang chọn, mỗi kết quả có "+ thời gian đi vòng" (ước lượng theo khoảng cách vuông góc tới tuyến) và nút **Thêm điểm dừng**.
- Thêm điểm dừng → chèn POI làm điểm ghé giữa điểm đi và đến (xem §6), tính lại tuyến, quay về panel chỉ đường.

### 4.5 Các panel còn lại
- Giao thông, Nhiều điểm, Đã lưu, Trợ lý, Tài khoản, Chi tiết địa điểm: giữ logic, chỉ chuyển sang SheetPanel + token mới, rà lại cỡ chữ/khoảng cách cho thống nhất.
- NavigationBanner (đang dẫn đường): đổi skin sang thẻ tối gradient phía trên, hướng rẽ chữ lớn; ẩn dock/chip khi đang dẫn đường (như hiện tại ẩn FeatureNav).
- Toast: góc trên giữa, kính mờ tối, tự ẩn (giữ useToast).

## 5. Dữ liệu mẫu (ví dụ minh họa)

Các tìm kiếm danh mục / dọc tuyến / thời tiết là **dữ liệu minh họa**, cô lập sau một interface để sau này thay bằng API thật:

```ts
interface PoiProvider {
  nearby(center: LatLng, category: PoiCategory, filters: PoiFilters): Promise<Poi[]>;
  alongRoute(path: Coordinate[], category: PoiCategory, filters: PoiFilters): Promise<Poi[]>;
}
```
- `mockPoiProvider` sinh 8–15 POI/danh mục bằng PRNG có seed (theo danh mục + ô lưới tọa độ làm tròn 0.01°) để kết quả ổn định khi bấm lại. Tên ghép từ danh sách tên Việt Nam theo danh mục (vd. "Khách sạn Hoàng Phát", "Cà phê Sân Thượng", "Nhà thuốc Long Châu" – tránh dùng thương hiệu thật, dùng tên chung chung), rating 3.5–4.9, số đánh giá, giá (VND), tiện ích, giờ mở cửa.
- Ảnh: dùng một danh sách nhỏ ảnh Unsplash theo danh mục (`https://images.unsplash.com/photo-...?w=240&q=60&auto=format`) với `loading="lazy"` và `onError` → fallback gradient + icon. Không chặn render nếu ảnh lỗi.
- Delay giả 250–400ms để hiện skeleton loading.
- Thời tiết: hàm mẫu theo giờ trong ngày (26–33°C), icon nắng/mây/mưa. Giao thông khu vực: dựa trên số incidents trong khung nhìn + giờ cao điểm (7–9h, 16:30–19h) → Thông thoáng / Vừa phải / Đông đúc + "chậm hơn ~N phút".
- Ghi rõ trên UI chữ nhỏ "Dữ liệu minh họa" ở chân PoiResultsPanel và AreaInsightCard.

## 6. Điểm dừng giữa đường

Kiểm tra `useDirections` và `RouteApiClient.calculate`: nếu API tuyến đã nhận nhiều điểm (nhiều điểm đang dùng `planMultiStopRoute`), thì "Thêm điểm dừng" / "+ Thêm điểm đến" chuyển sang panel **Nhiều điểm** với danh sách [điểm đi, POI, điểm đến] được điền sẵn (thêm prop `initialStops` + `key` để reset vào `MultiStopPanel`). Không tự viết lại thuật toán.

## 7. Bản đồ (LeafletMapController / MapView)

Bổ sung có kiểm soát (không phá API cũ):
- `setPoiMarkers(pois, { highlightedId })` + callback click marker.
- Nhãn tuyến (`L.marker` với `divIcon`) cho route options, callback chọn tuyến.
- `setOverlayVisibility({ traffic, incidents, terrain })`.
- Thêm `L.control.scale({ imperial: false })` góc dưới phải.
- Màu tuyến/marker đổi theo token mới; CSS divIcon đặt trong `styles.css`.

## 8. Thứ tự thực hiện

1. Tokens Tailwind + dark mode + `styles.css` (divIcon, sheet, scrollbar).
2. Shell: AppShell, SideDock, TopBar, SheetPanel, Popover; nối vào App.tsx thay FeatureNav/FloatingPanel. Chạy được, panel cũ vẫn mở bình thường.
3. Map: LayerSwitcher, TrafficLegend, MapControls, mở rộng LeafletMapController.
4. Explore: types, mockPoiProvider, CategoryChips, AreaInsightCard, PoiResultsPanel/PoiCard/PoiFilters, marker POI.
5. RoutePanel mới: TravelModeTabs, RouteOptionCard, DepartureSelect, Options popover, RouteShareBar, nhãn tuyến trên bản đồ, đọc tham số URL.
6. Tìm dọc tuyến + Thêm điểm dừng.
7. Skin lại các panel còn lại + NavigationBanner + toast.
8. Kiểm tra: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` ở gốc monorepo đều xanh; thêm unit test cho `mockPoiProvider` (deterministic, lọc đúng) và `areaInsight`.

## 9. Tiêu chí hoàn thành
- Mọi luồng cũ vẫn chạy: tìm địa điểm, chỉ đường, chọn tuyến, dẫn đường, nhiều điểm, báo cáo giao thông, đã lưu, trợ lý, đăng nhập.
- Có đủ: chip danh mục + kết quả, khu vực này, chọn lớp + lớp phủ, chú giải giao thông, chỉ đường nhiều phương án có nhãn trên bản đồ, tùy chọn/khởi hành/chia sẻ, tìm dọc tuyến + thêm điểm dừng.
- Desktop 1440×900, tablet 820×1180, mobile 390×844 không tràn ngang, không chồng lấn control.
- typecheck / lint / test / build pass.

---

# Phần 2 — Tìm kiếm thật (quanh đây + dọc tuyến) bằng VietMap

Thay toàn bộ dữ liệu minh họa POI bằng API thật. Người dùng gõ **bất kỳ từ nào** (phở, sửa xe, siêu thị, Highlands, bệnh viện…) hoặc bấm chip danh mục đều ra địa điểm thật.

## Đã kiểm chứng (12/11/2026, key trong `apps/api/.env`)
- Overpass/OSM: 35 giây và trả rỗng, **không dùng** cho tìm tương tác.
- VietMap Autocomplete v4 `GET https://maps.vietmap.vn/api/autocomplete/v4` với `text`, `focus=lat,lng`, `circle_center=lat,lng`, `circle_radius=<m>`, `cats=<mã>`, `layers=POI`, `display_type=6`: ~0,1 s, ≤10 kết quả/lần, có `ref_id`, `name`, `address`, `distance` (km từ focus), `categories`. **Không có lat/lng** → phải gọi Place v4 (`/api/place/v4?refid=`; trả `lat`, `lng`, `display`, `name`, `address`…; mỗi lần gọi = 1 giao dịch tính phí).
- Search v4 (`/api/search/v4`) cùng tham số, dùng làm lần thử thứ hai khi autocomplete rỗng (như provider hiện có).
- Mã danh mục quan sát được: `10009` cây xăng, `2001` khách sạn, `10013` trạm sạc VinFast, `6000` trạm sạc xe máy, `1001`/`1001-1` cà phê, `1005` quán ăn. Các danh mục khác (nhà hàng, tham quan, bảo tàng, xe buýt, nhà thuốc, ATM) chưa rõ mã → tìm theo từ khóa tiếng Việt, **không** đoán mã. Có thể dò mã bằng một lần gọi thủ công và chỉ ghi mã đã thấy thật.
- Kết quả trùng tên/địa chỉ khá nhiều → phải khử trùng.

## Backend (apps/api, module `places`, giữ Clean Architecture)
- Port mới `PoiSearchProvider` (application/ports) + `VietmapPoiSearchProvider` (infrastructure) dùng lại cách gọi/ánh xạ lỗi của `VietmapPlaceSearchProvider` (AUTH/QUOTA/UNAVAILABLE/NOT_CONFIGURED/INVALID_RESPONSE, không lộ key).
- Use case `SearchPoisAlongRouteUseCase` và `SearchPoisNearbyUseCase`:
  1. Đơn giản hóa polyline (≤ 500 điểm đầu vào), lấy mẫu điểm dọc tuyến: khoảng cách ≈ max(1,6 × bán kính, tổng chiều dài / 10), tối đa 12 điểm (gồm 2 đầu). Nearby = 1 điểm.
  2. Mỗi điểm mẫu gọi autocomplete v4 (song song, tối đa 4 cùng lúc), `text` = chữ người dùng hoặc từ khóa của danh mục, `cats` khi danh mục có mã đã xác minh, `layers=POI`, `circle_center` + `circle_radius`.
  3. Khử trùng theo `ref_id` và theo tên+địa chỉ đã chuẩn hóa (bỏ dấu, thường).
  4. Xếp theo thứ tự điểm mẫu dọc tuyến rồi `distance`; chỉ resolve tối đa `limit` (mặc định 20, tối đa 30) bằng Place v4 (song song tối đa 5), bỏ kết quả lỗi tọa độ.
  5. Có tọa độ thật rồi: tính khoảng cách vuông góc tới tuyến, vị trí dọc tuyến (m), thời gian đi vòng ước tính (2 × khoảng cách ÷ 25 km/h, làm tròn phút); loại điểm xa hơn bán kính; khử trùng lần 2 theo tọa độ (< 30 m cùng tên).
  - Cache trong bộ nhớ: Place v4 theo `ref_id` (LRU 2000 mục, 24 h); kết quả autocomplete theo (text, cats, tâm làm tròn 3 số, bán kính) 10 phút.
- Routes:
  - `POST /api/places/along-route` body `{ path: [lat,lng][], query?: string, category?: PoiCategory, radiusM?: 250–5000 (mặc định 1500), limit?: 1–30 }` — cần `query` hoặc `category`.
  - `GET /api/places/nearby?lat&lng&radiusM&query|category&limit`.
  - Validate bằng zod; áp rate limit giống các route khác nếu có middleware sẵn.
- Shared (`packages/shared`): thêm `PoiCategory`, `PoiResult` `{ id(ref_id), name, address, lat, lng, category: PoiCategory|null, categoryCodes: string[], distanceFromRouteM, positionAlongRouteM, detourMin, distanceFromCenterM? }` và schema request.
- Test (mock `fetch`, không gọi API thật): lấy mẫu điểm, gửi đúng tham số, khử trùng, giới hạn số lần Place v4, lọc theo bán kính, cache, lỗi nhà cung cấp, validate controller.

## Frontend (apps/web, `features/explore`)
- `ApiPoiProvider` thay `mockPoiProvider` (cùng interface `PoiProvider`, đổi chữ ký để nhận `query` tự do). **Xóa** mock provider, catalog tên giả, ảnh Unsplash, test của mock.
- Ô "Tìm dọc tuyến…" và tìm quanh đây nhận **mọi từ**: nếu khớp danh mục thì gửi `category` (để dùng mã `cats`), nếu không thì gửi `query` nguyên văn. Hết thông báo "Thử: xăng…".
- Quanh đây (chưa có tuyến): tâm = tâm bản đồ, bán kính theo mức zoom (zoom ≥15: 1 km, 13–14: 3 km, thấp hơn: 5 km); zoom quá xa (< 11) thì bay về vị trí hiện tại/tâm TP.HCM như hiện tại.
- PoiResultsPanel/PoiCard chỉ hiện dữ liệu **có thật**: tên, địa chỉ, nhãn danh mục, khoảng cách (tới tuyến hoặc tới tâm), thời gian đi vòng, vị trí "km thứ N trên tuyến". Ảnh = ô gradient + icon danh mục. **Bỏ** sao/đánh giá, giá, tiện ích, giờ mở cửa, hạng KS, thanh ngày/khách khách sạn và các bộ lọc tương ứng (không có dữ liệu). Bộ lọc còn lại: Sắp xếp (Theo tuyến / Gần nhất / Ít đi vòng nhất), Bán kính (500 m, 1 km, 2 km, 5 km).
- Trạng thái: skeleton khi tải, rỗng ("Không thấy '<từ khóa>' trong 1,5 km quanh tuyến — thử mở rộng bán kính"), lỗi có thông điệp theo mã lỗi (chưa cấu hình key, hết hạn mức…), nút Thử lại. Hủy request cũ khi đổi từ khóa (AbortController).
- Bỏ chữ "Dữ liệu minh họa" ở danh sách kết quả. Thời tiết ở thẻ "Khu vực này" vẫn là minh họa → ghi rõ "Thời tiết minh họa".
