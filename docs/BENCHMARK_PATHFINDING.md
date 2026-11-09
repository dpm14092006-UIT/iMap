# Benchmark Dijkstra vs A*

- Dữ liệu: OpenStreetMap trung tâm TP.HCM (`apps/api/data/osm/hcmc-center.json`), 17368 node, 31929 cạnh có hướng.
- Thời gian nạp + dựng đồ thị: 33 ms. Mỗi cấu hình chạy 200 cặp điểm ngẫu nhiên (seed cố định).
- Máy chạy: darwin arm64, Node v26.8.2. Ngày chạy: 2026-11-08.
- Số cặp có chi phí A* khác Dijkstra: **0** (phải bằng 0 để chứng minh A* vẫn tối ưu).

| Xe | Tiêu chí | Số cặp | Node duyệt Dijkstra | Node duyệt A* | A* giảm | ms Dijkstra | ms A* | Không có đường |
|---|---|---|---|---|---|---|---|---|
| motorcycle | distance | 200 | 7729 | 1917 | 75% | 3.16 | 0.96 | 0 |
| motorcycle | duration | 200 | 7566 | 3643 | 52% | 3.21 | 1.78 | 0 |
| car | distance | 200 | 7535 | 1914 | 75% | 3.01 | 0.91 | 0 |
| car | duration | 200 | 7429 | 3586 | 52% | 3.16 | 1.85 | 0 |

**Đọc kết quả:** "Node duyệt" là số node được lấy ra khỏi hàng đợi ưu tiên. A* dùng heuristic khoảng cách đường chim bay nên duyệt ít node hơn.
Với tiêu chí thời gian, heuristic = khoảng cách / tốc độ lớn nhất của đồ thị nên yếu hơn, A* giảm ít hơn so với tiêu chí quãng đường.
"Không có đường" phải bằng 0 vì điểm chỉ được snap vào mạng đường chính (thành phần liên thông mạnh lớn nhất).
