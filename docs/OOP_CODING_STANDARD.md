# Coding standard – OOP + SOLID

1. **SRP:** mỗi class một lý do thay đổi (`CreateTrafficReportUseCase` tạo report; `TrafficController` chỉ nhận/trả HTTP).
2. **OCP / DIP:** use case phụ thuộc interface `TrafficReportRepository` chứ không phụ thuộc Supabase class.
3. **LSP:** adapter mới triển khai đúng contract, có test (dùng fake repository trong test thay cho Supabase).
4. **ISP:** `RouteProvider`, `MatrixProvider`, `TrafficReportRepository` giữ hợp đồng nhỏ theo trách nhiệm.
5. **Dependency direction:** domain không import Express, React, DB, SDK hay config.
6. **Constructor injection:** container tạo repo/provider rồi truyền vào use case. Không dùng singleton global giấu dependencies.
7. **Data validation:** Zod ở HTTP edge; domain entity vẫn tự bảo vệ invariants.
8. **DTO ≠ Entity:** DTO đơn giản để serialize; domain giữ hành vi, không return entity nội bộ trực tiếp cho client.
9. **No mystery units:** server dùng meters/seconds, client convert km/km-h. GeoJSON `[lng,lat]`.
10. **Testing:** unit tests cho domain/use case; adapter tests bằng mock; integration tests với database staging; E2E trên mobile/desktop.
11. **Error handling:** domain error -> status phù hợp; không trả stack/secret ra client.
12. **React:** component chức năng + hooks, feature folders; không phải viết class component để gọi là OOP.
13. **Code review:** `packages/shared` và `composition-root.ts` phải được cả hai xác nhận.

## Ví dụ luồng dependency

`POST /api/traffic-reports` → `TrafficController.create` → `CreateTrafficReportUseCase.execute` → `TrafficReportRepository.save` → `SupabaseTrafficReportRepository`.
