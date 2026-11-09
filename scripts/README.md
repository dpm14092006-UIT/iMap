# Scripts

N1: importer OSM TP.HCM và thuật toán benchmark CLI; N2: seed dữ liệu phát triển và script check migrations/permissions. Không đưa API key trong script.

## N1 – OSM & benchmark

| Lệnh (chạy ở thư mục gốc) | Tác dụng |
|---|---|
| `npm run osm:import` | Tải đường OSM vùng trung tâm TP.HCM qua Overpass → `apps/api/data/osm/hcmc-center.json`. Tùy chọn `-- --bbox=south,west,north,east --out=...` |
| `npm run benchmark:pathfinding` | So sánh Dijkstra vs A* trên đồ thị thật; thêm `-- --write` để ghi `docs/BENCHMARK_PATHFINDING.md` |
