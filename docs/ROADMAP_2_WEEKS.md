# Lộ trình pilot P0 – 10 ngày làm việc (rút gọn)

| Ngày | N1: Navigation & Optimization | N2: Traffic & AI/Data | Mốc chung |
|---|---|---|---|
| 1 | Chốt UX Flow, MapView skeleton | Monorepo, backend/bootstrap | Chạy đồng thời web + api |
| 2 | SearchBar, location selection, vehicle switch | Shared schemas, migrations + Supabase Auth setup | API contract v1 |
| 3 | Vietmap tiles/search adapter và fallback | Traffic Report entity/repository/POST | Search demo + POST live |
| 4 | Route provider car/motorcycle, polyline | Traffic GET theo bbox, report UI | Map route + report |
| 5 | Responsive, map layer integration | Realtime Broadcast, clearance | Review tuần 1 |
| 6 | OSM graph khu vực nhỏ, Dijkstra | AI traffic image endpoint | Benchmark + AI test |
| 7 | A*, route algorithm tests | AI sign image endpoint | 2 AI tasks + test |
| 8 | Matrix, NN/2-opt, multi-stop UI | Storage, Auth/RLS, validation | Multi-stop demo |
| 9 | Reroute mô phỏng, My Routes | Realtime reconnect, security | P0 feature freeze |
| 10 | UX regression, Vercel | API tests, Render/Supabase | Deploy/demo/report |

**Giới hạn thực tế:** 2 tuần là mốc pilot tăng tốc, không đủ bảo đảm hoàn thiện routing/AI/traffic live toàn TP.HCM. Nếu thiếu quota/độ tin cậy, ưu tiên luồng end-to-end và ghi rõ chế độ sample, không làm giả kết quả.
