# Kịch bản demo phần N1 — Navigation & Optimization (5–7 phút)

Dùng **link thuyết trình** `http://localhost:5173/?demo=1` (hoặc link deploy + `?demo=1`).
Link thường không hiện các khối "Chế độ thuyết trình" và nút Demo — giao diện người dùng vẫn gọn.

## Chuẩn bị trước giờ thuyết trình (5 phút)

- [ ] `apps/api/.env` có `VIETMAP_API_KEY` (key cần quyền Route + Matrix). Kiểm tra `http://localhost:4000/api/health` → `"routing":"vietmap"`.
- [ ] `./run.sh`, mở `http://localhost:5173/?demo=1`, chọn ngôn ngữ (VI/EN) cố định.
- [ ] Chạy thử 1 lần cả kịch bản bên dưới để VietMap "nóng" và chắc còn hạn mức.
- [ ] Mở sẵn tab phụ: `docs/BENCHMARK_PATHFINDING.md`, `docs/BENCHMARK_TSP.md` (dự phòng khi mất mạng).
- [ ] Tắt thông báo hệ điều hành; phóng to trình duyệt 110–125% nếu chiếu máy chiếu.

## Kịch bản

| Thời gian | Thao tác | Nói gì |
|---|---|---|
| 0:00–0:45 | Panel **Chỉ đường**: gõ `Chợ Bến Thành` → `Landmark 81`, chọn Xe máy, bấm **Tìm đường**. Đổi sang **Ô tô**. | Tìm địa điểm qua VietMap (debounce, hủy request cũ); tuyến thật theo loại xe, đổi xe tự tính lại; có chỉ dẫn rẽ từng bước. |
| 0:45–2:15 | Kéo xuống khối **So sánh thuật toán** → **Chạy Dijkstra & A\***. Chỉ vào bảng và bản đồ (tím = Dijkstra, cam đứt = A\*, khung đứt = vùng dữ liệu). | Đồ thị tự dựng từ OpenStreetMap (≈17.000 nút, đường một chiều, cấm xe máy vào cao tốc). Dijkstra và A\* dùng chung khung `GraphSearchSolver` (Template Method), A\* thêm heuristic đường chim bay. **Cùng quãng đường tối ưu, A\* duyệt ít hơn ~60%.** Benchmark 200 cặp: 0 cặp lệch chi phí, giảm 52–75% nút. |
| 2:15–3:45 | Panel **Nhiều điểm**: xuất phát `Chợ Bến Thành`, thêm lộn xộn `Thảo Cầm Viên`, `Dinh Độc Lập`, `Landmark 81`, `Hồ Con Rùa`, `Nhà thờ Đức Bà`. Thuật toán **Nhanh (NN + 2-opt)** → **Tối ưu**. Rồi **Xóa hành trình**, nhập lại y thứ tự cũ, chọn **Chính xác (Held–Karp)** → **Tối ưu**. | Bài toán TSP đường đi mở trên ma trận thời gian có hướng của VietMap Matrix. Held–Karp (quy hoạch động O(n²·2ⁿ)) cho lời giải tối ưu tới 15 điểm trong vài chục ms; NN + 2-opt gần đúng, trung bình dài hơn tối ưu 1–3,5%. Thẻ kết quả: **tiết kiệm X% so với thứ tự nhập**. |
| 3:45–5:30 | Quay lại **Chỉ đường** (Bến Thành → Landmark 81) → **Bắt đầu chuyến đi**. Banner hiện **GPS giả lập (demo)**. Bấm **↪ Rẽ nhầm**, chờ 2–3 giây. Bấm **⚠ Sự cố phía trước**. | Dẫn đường dùng engine chung; nguồn vị trí là interface `PositionSource` (GPS thật / GPS giả — Strategy pattern). Lệch tuyến đủ lâu → tự gọi `/routes/reroute`. Sự cố trong 1,5 km phía trước → tính lại ngay: server chọn tuyến không qua sự cố → tuyến thay thế → đi vòng; không né được thì báo rõ. |
| 5:30–6:00 | Bấm công tắc **Thật** rồi **Demo**; **Kết thúc**. | Đổi nguồn vị trí giữa chuyến, giữ nguyên tuyến. Trên điện thoại ngoài đường dùng chế độ Thật. |
| 6:00–7:00 | (Tùy thời gian) mở `docs/BENCHMARK_TSP.md`. | Bảng so sánh Held–Karp / NN / NN + 2-opt từ 3 đến 15 điểm ghé. |

## Nếu có sự cố khi demo

| Tình huống | Cách xử lý |
|---|---|
| VietMap báo hết hạn mức / mất mạng | Phần **So sánh Dijkstra & A\*** vẫn chạy (đồ thị OSM nằm trên máy, không gọi VietMap). Chuyển sang mở 2 file benchmark. |
| Bấm "Sự cố phía trước" mà báo "không tìm được đường tránh" | Sự cố rơi sát điểm đầu/cuối — đúng thiết kế (đường duy nhất vào/ra). Nói rõ điều này, đợi xe chạy xa hơn rồi bấm lại. |
| Thuật toán báo "ngoài vùng dữ liệu" | Đồ thị OSM chỉ phủ trung tâm TP.HCM (khung đứt trên bản đồ). Chọn lại 2 điểm trong khung. |

## Câu hỏi hay gặp

- **Sao A\* vẫn tối ưu?** Heuristic = khoảng cách đường chim bay (hoặc chia tốc độ lớn nhất của đồ thị) không bao giờ lớn hơn chi phí thật (admissible, consistent).
- **Sao không đi được mọi cặp điểm trên đồ thị?** Điểm được gắn vào thành phần liên thông mạnh lớn nhất (Kosaraju) để luôn có đường.
- **Ma trận có hướng ảnh hưởng 2-opt thế nào?** Đảo một đoạn làm đổi chiều mọi cạnh bên trong, nên tính lại toàn bộ chi phí thay vì công thức 2 cạnh của TSP đối xứng.
- **Rerouting có gọi VietMap bao nhiêu lần?** Tối đa 3 lần mỗi lần tính lại (tuyến chính + 2 điểm vòng).
