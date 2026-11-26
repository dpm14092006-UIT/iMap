# Báo cáo kiểm chứng chủ quyền — 2026-11-26

**Kết luận:** vApp được chủ dự án **duyệt có điều kiện** (2026-11-26) cho Đường phố, Tối (style gốc), tổng quan và bản đồ phụ. Điều kiện còn mở: chưa đối chiếu đường biên giới với bộ bản đồ chuẩn (Điều 19, cần token VNSDI); điều khoản thương mại của vApp chưa rõ. Cổng `--live` vẫn báo FAIL ở mục đối chiếu biên giới cho tới khi có token. Báo cáo này không phải chứng nhận của cơ quan nhà nước.

## 1. Căn cứ pháp lý đã đọc

**Thông tư 17/2018/TT-BTNMT** (văn bản hợp nhất 103/VBHN-BNNMT, 02/11/2026; nguồn: datafiles.chinhphu.vn, 17 trang, trích văn bản bằng pdf.js). Thông tư "quy định kỹ thuật thành lập, cập nhật bộ bản đồ chuẩn biên giới quốc gia và thể hiện đường biên giới quốc gia, chủ quyền lãnh thổ quốc gia trên các sản phẩm đo đạc và bản đồ, xuất bản phẩm bản đồ"; áp dụng cho tổ chức, cá nhân thành lập bản đồ, xây dựng cơ sở dữ liệu địa lý có thể hiện biên giới, chủ quyền.

- **Điều 19.1:** sản phẩm thể hiện lãnh thổ Việt Nam phải dùng đường biên giới quốc gia, điểm đặc trưng phân bố lãnh thổ theo **bộ bản đồ chuẩn biên giới quốc gia được công bố**.
- **Điều 19.2:** chọn bản đồ chuẩn có tỷ lệ gần nhất; chuyển vẽ đường biên giới; kiểm tra tương quan địa lý; kiểm tra điểm đặc trưng phân bố lãnh thổ.
- **Điều 20.1:** sản phẩm toàn vẹn lãnh thổ phải thể hiện đầy đủ đường biên giới, điểm đặc trưng phân bố lãnh thổ trong giới hạn **4°30′–23°30′ vĩ Bắc, 102°00′–118°00′ kinh Đông**.
- **Điều 20.2:** sản phẩm thể hiện một phần lãnh thổ đất liền có liên quan đến chủ quyền biển, đảo phải có **bản đồ phụ thể hiện toàn vẹn lãnh thổ**.
- **Điều 20.3:** sản phẩm thể hiện toàn bộ hoặc một phần **Đà Nẵng, Khánh Hòa, TP. Hồ Chí Minh, An Giang** phải có bản đồ phụ thể hiện các đảo, quần đảo trực thuộc.

Chưa đọc trong đợt này: toàn văn Luật Đo đạc và bản đồ 27/2018/QH14 và VBHN 70/VBHN-VPQH (2026) — xem ROADMAP.

## 2. Đáp ứng trong ứng dụng

| Yêu cầu | Cách đáp ứng | Trạng thái |
|---|---|---|
| Điều 19 — biên giới theo bộ bản đồ chuẩn | Registry chỉ cho production dùng nguồn APPROVED; vApp/VIETMAP chưa được duyệt vì chưa đối chiếu với VNSDI | **Chưa đạt** — cần token VNSDI để đối chiếu |
| Điều 20.1 — khung 4°30′–23°30′B, 102°–118°Đ | `VIETNAM_TERRITORY_EXTENT`; nút "Xem toàn Việt Nam" khớp khung này; cổng kiểm vùng phủ 31 điểm | Đạt với vApp (dữ liệu tại cả 31 điểm) |
| Điều 20.2–20.3 — bản đồ phụ | `VietnamInset`: hiện khi xem một phần lãnh thổ, phủ 101,56°–118,41°Đ / 3,95°–24,06°B, ghi "QĐ Hoàng Sa", "QĐ Trường Sa"; bấm để về toàn cảnh | Đạt ở 10 khung nhìn kiểm thử |
| Tên Hoàng Sa, Trường Sa, Biển Đông | Nguồn có lớp chủ quyền (vApp) tự thể hiện; nền không có nhãn (vệ tinh, dự phòng) dùng nhãn iMap; không chồng chữ | Đạt |
| Không đường lưỡi bò / tên nước ngoài | Quét mã nguồn (342 file), style và 21 ô vector vApp; ảnh chụp | Đạt (vApp). VIETMAP chưa quét được (423) |
| Vệ tinh | VNSDI Sentinel-2 + nhãn iMap | **Chưa đạt Điều 20.1** khi xem toàn cảnh: ảnh không có đường biên giới |

## 3. Cổng kiểm chứng (`npm run verify:sovereignty`)

Năm cổng: Geographic Coverage · Boundary Validation · Place Name Validation · License Validation · Visual Regression (15 khung nhìn: toàn cảnh VI/EN/Tối/Vệ tinh/Hành chính mức 5; Hoàng Sa, Trường Sa mức 9; TP.HCM mức 12 và 16; Hà Nội 12; Đà Nẵng 10; Khánh Hòa 10; Phú Quốc–An Giang 10; Côn Đảo 12; biên giới phía Bắc 8).

**Offline (ô giả lập, so ảnh chuẩn):** 5/5 đạt, có cảnh báo (chưa nguồn APPROVED; Hành chính không có nguồn).

**Live (dữ liệu thật):** 3/5 — CHẶN:
- Boundary FAIL: chưa có token VNSDI để đối chiếu biên giới.
- License FAIL: API chưa cấu hình `VNSDI_BASEMAP_TOKEN`.
- Cảnh báo: VIETMAP 423; vùng định tuyến VIETMAP không phủ Lũng Cú, A Pa Chải; dữ liệu gốc OSM trong vApp và trợ lý địa điểm.

Bằng chứng: `docs/basemap/evidence/2026-11-26/` (15 ảnh live + `sovereignty-report-live.json`).

## 4. Hạn chế của phép kiểm

- Quét tên trong ô vector là quét chuỗi UTF-8, không giải mã hình học: phát hiện tên sai, **không** chứng minh đường biên giới đúng.
- Nhãn "QĐ Hoàng Sa", "QĐ Trường Sa" trong bản đồ phụ do iMap ghi (vị trí từ `vietnamArchipelagos.ts`), vì ở tỷ lệ bản đồ phụ nền có thể lược chữ. Không vẽ đường biên giới hay vùng biển.
- Chưa kiểm: kết quả tìm kiếm/autocomplete/reverse geocoding, popup, link chia sẻ, ảnh xuất bản đồ (ROADMAP).
