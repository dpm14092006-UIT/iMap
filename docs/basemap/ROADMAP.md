# Việc còn lại (theo bản đặc tả IMAP V2)

## Cần chủ dự án làm (blocker)

1. **Token VNSDI** — vnsdi.mae.gov.vn → "Đăng ký sử dụng dữ liệu" → Đăng ký mới; ghi mục đích "ứng dụng iMap, dịch vụ BanDoHanhChinhVietNam, BanDoDiaHinh". Dán vào `apps/api/.env` (`VNSDI_BASEMAP_TOKEN`), đổi `vnsdi-admin`, `vnsdi-terrain` sang TESTING, chạy `npm run verify:sovereignty -- --live`.
2. **Hỏi vApp (support@erpfit.com):** dùng style.json cho ứng dụng có thể thương mại hóa được không; được đổi màu style (Tối, bốn style iMap) không; vApp đã đối chiếu biên giới với bộ bản đồ chuẩn biên giới quốc gia chưa.
3. **VIETMAP:** trên console bật Tile cho khóa hoặc tạo khóa "public tile" có giới hạn domain; xác nhận hạn mức Trial (500/ngày hay không giới hạn).
4. **Hỏi VNSDI** điều khoản dùng Sentinel2 trong ứng dụng bên thứ ba.
5. **Phê duyệt:** người phụ trách duyệt từng nguồn theo `docs/basemap/README.md`.
6. **Git:** khởi tạo repository/feature branch (thư mục hiện chưa là git), rồi deploy staging.

## Kỹ thuật tiếp theo

- **Bốn style (Standard, Dark, Voyager, Minimal) — §10:** chỉ làm khi nguồn cho phép đổi style. Hướng khả thi: VIETMAP Map Editor (lớp chủ quyền chỉ đổi màu, không ẩn được) hoặc vApp nếu ERPFit cho phép. Bảng màu đã có trong bản đặc tả; khi làm, thêm `styleVariants` vào registry và test giữ nguyên lớp `sov-*`.
- **Vệ tinh đạt Điều 20.1:** chồng lớp ranh giới chính thức của VNSDI (cần token) lên Sentinel-2, hoặc dùng VIETMAP `hm` sau khi kiểm chứng.
- **Kiểm chứng tầng ứng dụng — §8:** test tên trong kết quả tìm kiếm, autocomplete, reverse geocoding (VIETMAP), popup, link chia sẻ, ảnh xuất bản đồ; thêm vào cổng.
- **Zoom 3–18 — §13:** cổng hiện kiểm 5, 8, 9, 10, 12, 16; bổ sung 3, 4, 6, 14, 18 khi có nguồn được duyệt.
- **Test Playwright cũ (`scripts/verify/browser.mjs`)** đang lỗi ở bước đầu (chờ tiêu đề "Chỉ đường" khi mở app, nay là nút) — cần cập nhật để chạy hết phần bản đồ.
- **Đọc toàn văn** Luật Đo đạc và bản đồ 27/2018/QH14 và VBHN 70/VBHN-VPQH (2026).

## Phase 8 — Bản đồ tự host (PMTiles)

Chỉ làm khi có dữ liệu chính thức và quyền tái phân phối. Quy trình: Acquire Licensed Data → Validate → Normalize → Planetiler/Tippecanoe → PMTiles → Geographic QA (cổng này) → Publish (Cloudflare R2). Mỗi dataset lưu nguồn gốc, phiên bản, checksum, giấy phép. Không sao chép ô vApp/VIETMAP. Ước tính chi phí R2 cần số liệu lượt xem thực tế — chưa có.
