# Quyền sở hữu module – Team 2 người

| Phạm vi | Owner | Reviewer |
|---|---|---|
| Web shell, MapView, SearchBar, VehicleSwitcher, Street/Satellite | N1 | N2 |
| Vietmap Search/Places/Route provider | N1 | N2 |
| OSM graph, GeoPoint, Dijkstra/A* | N1 | N2 |
| Multi-stop Matrix + Nearest Neighbor + 2-opt | N1 | N2 |
| Dynamic Reroute, My Routes | N1 | N2 |
| Traffic UI, warning forms, clearance | N2 | N1 |
| Traffic Report use cases, repository | N2 | N1 |
| Realtime Broadcast, road clearance, expiry | N2 | N1 |
| AI Traffic + AI Sign image inference | N2 | N1 |
| Supabase DB/PostGIS/Auth/RLS/Storage/migrations | N2 | N1 |
| Express bootstrapping, security middleware, deployment | N2 | N1 |
| Shared DTO, event contracts, DI composition root | BOTH | BOTH |
| E2E, CI, QA, docs | BOTH | BOTH |

## Quy trình

- Branch N1: `feat/nav-...`; branch N2: `feat/traffic-...`, `feat/ai-...`.
- Một PR = một nhiệm vụ độc lập; không push thẳng `main`.
- Sửa contract, migration, composition root phải có review của người còn lại.
- Kết thúc ngày: merge/đẩy bản tích hợp chạy được lên staging; không dồn vào ngày 10.
