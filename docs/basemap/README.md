# iMap V2 — Bản đồ nền ưu tiên chủ quyền Việt Nam

Cập nhật: 2026-11-26. Tài liệu bàn giao cho đợt nâng cấp bản đồ nền (bản đặc tả "IMAP V2 — Vietnam Sovereignty-First Basemap Engine").

## Đọc theo thứ tự

1. [REPO_AUDIT.md](REPO_AUDIT.md) — Phase 1: các phụ thuộc bản đồ, định tuyến, tìm kiếm, OSM trong repo.
2. [PROVIDER_ASSESSMENT.md](PROVIDER_ASSESSMENT.md) — Phase 2–3: đánh giá VNSDI, vApp, VIETMAP, eKMap, OpenMap.vn, MapsLibVN, OSM; giấy phép, nguồn gốc dữ liệu, chi phí.
3. [SOVEREIGNTY_VALIDATION_REPORT.md](SOVEREIGNTY_VALIDATION_REPORT.md) — căn cứ pháp lý (TT 17/2018/TT-BTNMT, Điều 19–20), kết quả cổng kiểm chứng, bằng chứng.
4. [ROADMAP.md](ROADMAP.md) — việc còn lại: bốn style, Vietnam Overview nâng cao, PMTiles tự host, staging.

## Tóm tắt trạng thái

| Nguồn | Trạng thái | Dùng cho | Chặn bởi |
|---|---|---|---|
| VNSDI · Hành chính | BLOCKED | Hành chính, tổng quan, đối chiếu biên giới | Cần token (tài khoản VNSDI) |
| VNSDI · Địa hình | BLOCKED | Lớp Địa hình | Cần token |
| VNSDI · Sentinel-2 | TESTING | Vệ tinh | Không có đường biên giới; điều khoản chưa rõ |
| vApp (map.vapp.vn) | **APPROVED (có điều kiện, 2026-11-26)** | Đường phố, Tối (style gốc), tổng quan, bản đồ phụ | Chưa đối chiếu biên giới với bộ bản đồ chuẩn; điều khoản thương mại/đổi style chưa rõ |
| VIETMAP | TESTING | Tối, Vệ tinh (hybrid), dự phòng | Khóa hiện tại bị 423 khi tải ô |
| OpenMap.vn | BLOCKED | — | Cần tài khoản/khóa |
| eKMap, MapsLibVN | BLOCKED | — | Không truy cập được |
| OSM Standard | REJECTED | — | Không dùng làm nền hay dự phòng |

**vApp được chủ dự án duyệt có điều kiện ngày 2026-11-26** cho Đường phố, Tối (style gốc), tổng quan và bản đồ phụ, chấp nhận chưa đối chiếu biên giới với VNSDI (Điều 19). Các nguồn khác chưa duyệt: production không dùng Vệ tinh, Hành chính, Địa hình (nút bị làm mờ). Bản dev dùng thêm nguồn TESTING để thu thập bằng chứng.

## Cách phê duyệt một nguồn (người phụ trách)

1. Giải quyết các mục `blockers` của nguồn trong `apps/web/src/features/map/basemap/providers.ts`.
2. Chạy API (`npm run dev` hoặc cấu hình `imap-api-4000`), rồi `npm run verify:sovereignty -- --live`.
3. Xem ảnh trong `reports/sovereignty/*-live.png` và báo cáo `reports/sovereignty/report.json`.
4. Nếu đạt, sửa nguồn trong registry: `status: 'APPROVED'`, thêm `approval: { by, date, report }`, cập nhật `evidence`, `lastVerified`. Lưu ảnh bằng chứng vào `docs/basemap/evidence/<ngày>/`.
5. Test `providers.test.ts` và cổng kiểm chứng chặn mọi nguồn APPROVED thiếu người duyệt.

## 3D (địa hình, toà nhà khối)

Nghiêng, xoay bản đồ và dẫn đường 3D không đổi style nên bật ngay. Địa hình nổi và khối toà nhà dùng dữ liệu của nguồn (registry `features3d`), chỉ THÊM lớp của iMap dưới lớp chữ, không đổi lớp `sov-*`. Production chỉ bật khi có `features3d.approval`. vApp đang chờ ERPFit xác nhận (ROADMAP mục 2); khi có, ghi `approval: { by, date, report }` vào `features3d` của vApp. Khi bật, ghi thêm nguồn "Độ cao © Mapzen / AWS Terrain Tiles".

## 4D (dòng thời gian)

Nút đồng hồ mở thanh "Dòng thời gian":

- **Ánh sáng theo giờ:** `shared/geo/sunPosition.ts` (công thức NOAA) tính vị trí mặt trời tại tâm bản đồ, rồi đặt `setLight` (hướng, độ cao, màu) và `setSky`. MapLibre không vẽ bóng đổ thật, nên giao diện ghi "Ánh sáng mô phỏng theo vị trí mặt trời". Không đổi lớp nào của nguồn, kể cả hillshade của vApp.
- **Phát lại hành trình:** `routing/domain/routePlayback.ts` gán mốc thời gian cho từng điểm của tuyến. Tốc độ lấy theo từng chỉ dẫn VietMap; chặng không có chỉ dẫn thì chia đều thời gian. Camera nghiêng và bay theo tuyến ở tốc độ ×60, ×240 hoặc ×960. Khi bật giảm chuyển động, camera không xoay.
- Không có "giao thông theo thời gian": VietMap chỉ có dữ liệu giao thông thời gian thực.

## Lệnh

```bash
npm run verify:sovereignty
```

```bash
npm run verify:sovereignty -- --live
```

```bash
npm run verify:sovereignty -- --update-baseline
```

Cổng cũng chạy trong `npm run verify` (vòng 6).

## Giới hạn

- Không tuyên bố đã tuân thủ pháp luật hay được cơ quan nhà nước chứng nhận. vApp chỉ được chủ dự án duyệt có điều kiện; các nguồn khác ở mức TESTING/BLOCKED.
- Dòng "Nguồn" trong giao diện (bảng Lớp, menu Thông tin bản đồ) lấy từ registry: production chỉ ghi nguồn đã duyệt.
