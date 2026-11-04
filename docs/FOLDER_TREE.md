# Folder tree và ownership

```text
RouteTwin_OOP_Starter/
├── apps/
│   ├── web/                            React + Vite + TypeScript + Tailwind CSS
│   │   └── src/
│   │       ├── app/                     App shell, feature composition, panel layout
│   │       ├── features/
│   │       │   ├── map/                 [N1] MapView, layer controls, map data/types
│   │       │   ├── places/              [N1] Search, autocomplete
│   │       │   ├── navigation/          [N1] GPS / vehicle / route results
│   │       │   ├── multi-stop/          [N1] TSP route planner
│   │       │   ├── my-routes/           [N1] Saved routes
│   │       │   ├── traffic/             [N2] Quick reports / clearance / hook
│   │       │   ├── ai-vision/           [N2] Upload / AI results
│   │       │   └── auth/                [N2] Supabase Auth UI
│   │       └── shared/                  API client, UI utilities, icons
│   └── api/                            Express + TypeScript
│       └── src/
│           ├── main.ts                 App entry point
│           ├── app.ts                  HTTP routes + middleware
│           ├── composition-root.ts     Dependency Injection / wiring
│           ├── config/                 Validated environment variables
│           ├── shared/                 Errors, middleware, HTTP conventions
│           └── modules/
│               ├── places/             [N1] Vietmap Places/Autocomplete
│               ├── navigation/         [N1] Routing, OSM, Dijkstra/A*
│               ├── optimization/       [N1] Matrix, TSP, NN, 2-opt
│               ├── my-routes/          [N1] Saved Routes API
│               ├── traffic/            [N2] Entity, Use Cases, Repo, HTTP
│               │   ├── domain/         Entities + rules
│               │   ├── application/    Use Cases + Ports
│               │   ├── infrastructure/ DB/realtime adapters
│               │   └── presentation/   Controllers + Express routes
│               ├── ai-vision/          [N2] Gemini traffic/sign adapters
│               └── auth/               [N2] JWT, current user, permissions
├── packages/shared/                  [BOTH] Types, Zod DTO contracts
├── supabase/migrations/               [N2] PostGIS, schema, RLS
├── docs/                              [BOTH] Architecture / ownership
├── .github/workflows/                [BOTH] CI checks
├── scripts/                           Import/test helper scripts
├── run.sh                             Launcher Mac one command
└── package.json                       npm workspaces
```

## Chuẩn cho mỗi module backend mới

`domain` → không import framework, SDK; `application` → case nghiệp vụ, ports; `infrastructure` → Vietmap/Gemini/Supabase adapters; `presentation` → controller HTTP, schema validation.

Module nhỏ có thể khởi tạo các folder khi bắt đầu triển khai, không cần tạo hàng chục class rỗng. Ưu tiên class có trách nhiệm và test rõ ràng hơn là dùng kế thừa phức tạp.
