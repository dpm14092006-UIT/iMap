# Phase 2–3 — Đánh giá nguồn bản đồ, giấy phép, nguồn gốc dữ liệu, chi phí

Ngày kiểm tra: 2026-11-26. Mọi số liệu dưới đây là kết quả gọi thật (curl/trình duyệt) hoặc đọc tài liệu công khai của nhà cung cấp; nơi nào chưa kiểm được thì ghi "chưa xác định". Không tải hàng loạt ô bản đồ: mỗi lần chạy cổng `--live` tải khoảng 60 ô vApp và một số ô VNSDI/VIETMAP.

## A. VNSDI (Cổng thông tin không gian địa lý Việt Nam, vnsdi.mae.gov.vn)

**Đơn vị:** Trung tâm Hạ tầng dữ liệu không gian địa lý, Cục Đo đạc, Bản đồ và Thông tin địa lý Việt Nam (Bộ Nông nghiệp và Môi trường).

| Endpoint | Kết quả |
|---|---|
| `/basemap/rest/services?f=json` | 200; danh mục công khai chỉ hiện `Sentinel2` (MapServer) |
| `/basemap/rest/services/BanDoHanhChinhVietNam/MapServer` | 499 Token Required (HTTP 200 + JSON lỗi) |
| `/basemap/rest/services/BanDoNenTyLeNho/MapServer` | 499 Token Required |
| `/basemap/rest/services/BanDoDiaHinh/MapServer` | 499 Token Required |
| `.../BanDoHanhChinhVietNam/MapServer/WMTS/1.0.0/WMTSCapabilities.xml` | 499 Token Required |
| `/basemap/services/BanDoHanhChinhVietNam/MapServer/WMSServer?GetCapabilities` | HTTP 499 |
| `/server/rest/services` | thư mục `BangChap, BDHCVN, Hosted, Utilities`; liệt kê từng thư mục lỗi cấu hình portal |
| `/basemap/rest/services/Sentinel2/MapServer?f=json` | 200, không cần token |
| dosm.vnsdi.gov.vn | 200 (trang "Chia sẻ dữ liệu"); `/basemap/...` trả 404 |
| dosmvn.mae.gov.vn | 200 (trang tin) |
| bandovn.vn | 302 (ASP.NET cookie check) |

**CORS:** máy chủ phản hồi `Access-Control-Allow-Origin` bằng đúng Origin gửi lên.

**Metadata BanDoHanhChinhVietNam / BanDoDiaHinh** (đọc từ trang công khai `vnsdi.mae.gov.vn/bandohanhchinh`, nơi chính VNSDI nhúng dịch vụ): ArcGIS 11.4 cached MapServer, Web Mercator (WKID 102100/3857), ô PNG32 256 px, LOD 0–23, maxScale 2256,99 (≈ mức 18). Phạm vi BanDoHanhChinhVietNam: x 7.235.720–16.697.877, y −2.273.080–5.621.455. Copyright: "Cục Đo đạc, Bản đồ và Thông tin địa lý Việt Nam, VNSDI"; BanDoDiaHinh: "NASA, JAXA". Khả năng: `Map`, `exportTilesAllowed: false`.

**Độ chi tiết:** đã xem trực tiếp ở mức 13 (TP.HCM) và 16 (Hà Nội): chỉ có nền hành chính, sông, ga, nhãn lớn, không có lưới đường phố. Dùng được cho tổng quan quốc gia, bản đồ phụ, lớp Hành chính và đối chiếu biên giới; không thay được bản đồ đường phố.

**Sentinel2:** "Ảnh Sentinel-2 không mây, xử lý tăng cường nét bởi Trung tâm Hạ tầng dữ liệu không gian địa lý". minScale 18.489.297 (≈ mức 5), maxScale 9.028 (≈ mức 16), phạm vi lon 102,05°–117,97°, lat 6,84°–23,50° (chưa phủ 4,5°–6,8°N). Ảnh không có đường biên giới, mosaic loang lổ ở mức thấp.

**Quyền sử dụng:** token chỉ cấp qua tài khoản ("Đăng ký sử dụng dữ liệu" → Đăng nhập/Đăng ký mới). Chưa tìm thấy điều khoản cho phép dùng trong ứng dụng bên thứ ba. Token nhúng trong trang công khai của VNSDI là token cấp cho trang đó; **không dùng**.

**Kết luận:** nguồn chính thức để đối chiếu chủ quyền. `vnsdi-admin`, `vnsdi-terrain` = BLOCKED (cần token). `vnsdi-sentinel2` = TESTING.

## B. vApp Map (map.vapp.vn — CÔNG TY TNHH ERPFIT)

- **Kỹ thuật:** `style.json` (19 lớp, tên "vapp-basemap"), nguồn vector `/tiles/basemap/{z}/{x}/{y}` (maxzoom 16), raster-dem địa hình (maxzoom 11, "Mapzen / AWS Terrain Tiles"), glyphs `/fonts/...`, không có sprite. CORS `*`. Không cần khóa.
- **Lớp chủ quyền:** `sov-dots` (đảo, đá, bãi) và `sov-names` (tên quần đảo, biển, đảo). iMap giữ nguyên, không ẩn, không đổi màu.
- **Kiểm tra dữ liệu (live, 2026-11-26):** ô vector có dữ liệu tại cả 31 điểm chuẩn (điểm cực, đảo tiền tiêu, 2 quần đảo, 15 đảo). Quét 21 ô quanh Biển Đông (mức 4–8): có "Hoàng Sa", "Trường Sa", "Biển Đông", "Phú Lâm", "Ba Bình"; không có Paracel/Spratly/Xisha/Nansha/Sansha/西沙/南沙/南海…; không thấy đường lưỡi bò trong ảnh chụp.
- **Chất lượng:** lớp bóng địa hình chỉ phủ một hình chữ nhật (vệt cạnh thẳng ở mức 5); ở mức 5 có nhãn "Huyện Hương Sơn" lẫn với nhãn tỉnh. Không vệ tinh.
- **Điều khoản (dieu-khoan-su-dung, 2026-10-20):** "thể hiện biên giới và chủ quyền Việt Nam, gồm quần đảo Hoàng Sa và Trường Sa, theo Luật Đo đạc và bản đồ số 27/2018/QH14"; dữ liệu OSM, Overture, Wikidata, dữ liệu công khai Việt Nam; cấm gỡ ghi nguồn, scraping, phân phối lại dữ liệu thô; giai đoạn alpha, "theo hiện trạng", không SLA. Không nói rõ dùng thương mại hay tự đổi style.
- **Chi phí:** hiển thị bản đồ không tính lượt, không cần khóa. API (geocode, tìm kiếm, chỉ đường): Developer miễn phí 20.000 lượt/tháng, 1.000/ngày, 60/phút; miễn phí cho giáo dục.
- **Kết luận:** TESTING. Ứng viên tốt nhất cho Đường phố miễn phí. Chặn bởi: đối chiếu biên giới với VNSDI (Điều 19), xác nhận điều khoản thương mại/đổi style với support@erpfit.com.

## C. VIETMAP

- **Style:** `tm` (street), `lm` (light), `dm` (dark), `hm` (hybrid) dạng style.json; raster `st` (satellite).
- **Thực tế với khóa hiện có:** style 200; **mọi ô vector và raster 423 "Your request is limited"**. Autocomplete, Route vẫn 200.
- **Tài liệu:** 423 = hết hạn mức **hoặc** API chưa bật cho khóa; khóa dùng thử mặc định tắt Tile; VIETMAP tách khóa "default" (backend) và "public tile". 25 request Tile = 1 transaction; tài khoản mới 60.000 transactions miễn phí; trang Giới hạn sử dụng ghi Trial 500/ngày mỗi API (mâu thuẫn với trang chính — cần hỏi VIETMAP).
- **Map Editor:** tạo style riêng; "Đường ranh giới chủ quyền chỉ đổi được sang một màu đặc khác, không ẩn và không làm mờ được".
- **Kết luận:** TESTING. Cần bật Tile hoặc tạo khóa public tile (giới hạn domain) trên console VIETMAP. Không kích hoạt gói trả phí.

## D. eKMap (ekgis.vn)

`docs.ekgis.vn` không phân giải được tên miền (curl mã 6), `ekgis.vn` lỗi kết nối TLS (mã 35); tìm kiếm web không ra tài liệu. **BLOCKED.**

## E. OpenMap.vn

`openmap.vn` chuyển hướng 301 sang `ndamaps.vn`. Tài liệu: style `day-v1`, `night-v1`, `satellite-v1` tại `maptiles.openmap.vn/styles/{id}/style.json?apikey=…`, tương thích MapLibre, bắt buộc khóa qua enterprise.openmap.vn. Không tìm thấy hạn mức, điều khoản, nguồn dữ liệu hay thông tin chủ quyền. **BLOCKED** (cần tài khoản).

## F. MapsLibVN

`mapslibvn.pages.dev` không phân giải được; tìm kiếm web không thấy dự án. **BLOCKED.**

## G. OpenStreetMap / Overture

Ô OSM Standard: **REJECTED** cho hiển thị (không làm nền, không làm dự phòng). Dữ liệu OSM vẫn dùng ở: (1) gián tiếp qua vApp; (2) Overpass cho trợ lý địa điểm; (3) đồ thị benchmark. Mọi chỗ đều ghi nguồn ODbL.

## Lựa chọn (Phase 3)

| Chế độ | Chuỗi dự phòng (registry `MODE_CHAINS`) |
|---|---|
| Đường phố | vApp → VIETMAP |
| Tối | VIETMAP `dm` → vApp (style gốc sáng, vì chưa rõ quyền đổi style) |
| Vệ tinh | VNSDI Sentinel-2 → VIETMAP `hm` |
| Hành chính | VNSDI hành chính (BLOCKED → nút bị làm mờ) |
| Địa hình | VNSDI địa hình (BLOCKED) |
| Tổng quan / bản đồ phụ | VNSDI hành chính → vApp |

## Nguồn gốc dữ liệu và giấy phép

| Nguồn | Dữ liệu gốc | Giấy phép / điều kiện | Ghi nguồn hiển thị |
|---|---|---|---|
| vApp | OSM (ODbL 1.0), Overture, Wikidata, dữ liệu công khai VN | Điều khoản ERPFit; cấm gỡ ghi nguồn | © map.vapp.vn · © OpenStreetMap |
| VNSDI hành chính/địa hình | Cục Đo đạc, Bản đồ và Thông tin địa lý VN; NASA, JAXA | Theo tài khoản đăng ký (chưa có văn bản) | © Cục Đo đạc, Bản đồ và Thông tin địa lý Việt Nam (VNSDI) [· NASA, JAXA] |
| VNSDI Sentinel-2 | Copernicus Sentinel-2, xử lý bởi VNSDI | Công khai; điều khoản chưa rõ | © … (VNSDI) · Ảnh Sentinel-2 (Copernicus) |
| VIETMAP | VIETMAP | Thương mại theo hợp đồng | © Vietmap |
| Trợ lý địa điểm | OSM qua Overpass | ODbL 1.0 | "Nguồn OSM", "Tìm thấy qua dữ liệu OpenStreetMap" |

## Chi phí (MVP, theo số liệu đọc được)

| Hạng mục | Chi phí hiện tại | Rủi ro |
|---|---|---|
| Nền vApp | 0 đ (hiển thị không tính lượt) | Alpha, không SLA; điều khoản thương mại chưa rõ |
| VNSDI | 0 đ (dịch vụ nhà nước) | Cần token; có thể giới hạn theo tài khoản |
| VIETMAP tile | Hiện không dùng được (423) | 25 request = 1 transaction; 60.000 transactions miễn phí ban đầu, sau đó bậc từ 50 đ/transaction |
| VIETMAP định tuyến/tìm kiếm | Đang dùng, trong hạn mức thử | Trang Giới hạn sử dụng ghi 500/ngày mỗi API |
| Cloudflare R2 / PMTiles | Chưa dùng | Xem ROADMAP |

Không kích hoạt dịch vụ trả phí, không tạo tài khoản phụ để vượt hạn mức.
