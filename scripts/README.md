# Scripts

Thư mục dành cho tiện ích dùng thực tế như importer, seed hoặc kiểm tra migration. Không ghi API key hoặc dữ liệu người dùng vào script.

## N1 – OSM & benchmark

| Lệnh (chạy ở thư mục gốc) | Tác dụng |
|---|---|
| `npm run osm:import` | Tải đường OSM vùng trung tâm TP.HCM qua Overpass → `apps/api/data/osm/hcmc-center.json`. Tùy chọn `-- --bbox=south,west,north,east --out=...` |
| `npm run benchmark:tsp` | So sánh Held–Karp vs Nearest Neighbor vs NN + 2-opt (3–15 điểm ghé, ma trận giả lập); thêm `-- --write` để ghi `docs/BENCHMARK_TSP.md` |
| `npm run benchmark:pathfinding` | So sánh Dijkstra vs A* trên đồ thị thật; thêm `-- --write` để ghi `docs/BENCHMARK_PATHFINDING.md` |
