# Scripts

Thư mục dành cho tiện ích dùng thực tế như importer, seed hoặc kiểm tra migration. Không ghi API key hoặc dữ liệu người dùng vào script.

## N1 – OSM & benchmark

| Lệnh (chạy ở thư mục gốc) | Tác dụng |
|---|---|
| `npm run osm:import` | Tải đường OSM vùng trung tâm TP.HCM qua Overpass → `apps/api/data/osm/hcmc-center.json`. Tùy chọn `-- --bbox=south,west,north,east --out=...` |
| `npm run benchmark:pathfinding` | So sánh Dijkstra vs A* trên đồ thị thật; thêm `-- --write` để ghi `docs/BENCHMARK_PATHFINDING.md` |
