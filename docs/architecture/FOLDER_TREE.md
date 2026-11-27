# Cấu trúc thư mục

```text
iMap/
├── apps/
│   ├── web/
│   │   ├── public/                       Service worker, icons, manifest
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── app/
│   │       │   ├── App.tsx                Lắp ghép các feature
│   │       │   ├── flows/
│   │       │   │   ├── workspace/         Panel, chọn điểm, phím tắt
│   │       │   │   ├── guidance/          Dẫn đường, tính lại tuyến
│   │       │   │   ├── traffic/           Báo cáo và cảnh báo
│   │       │   │   ├── routes/            Chia sẻ, lưu, tối ưu
│   │       │   │   └── explore/           Tìm quanh đây, trợ lý
│   │       │   ├── shell/                AppShell, dock, topbar, toast
│   │       │   └── styles/               Bố cục shell
│   │       ├── features/
│   │       │   ├── routing/              Tuyến, phương án, chỉ đường, chia sẻ
│   │       │   ├── guidance/             GPS, tiến độ, lệch tuyến, giọng nói
│   │       │   ├── map/                  MapView, MapLibre Facade, các lớp vẽ, 3D/4D
│   │       │   ├── places/               Tìm kiếm, combobox, lịch sử địa điểm
│   │       │   ├── explore/              POI quanh điểm/dọc tuyến
│   │       │   ├── multi-stop/           Form tối ưu hành trình
│   │       │   ├── my-routes/            Tuyến đã lưu, localStorage repository
│   │       │   ├── traffic/              Báo cáo, ảnh, realtime, cảnh báo
│   │       │   ├── place-assistant/      Tìm theo nhu cầu
│   │       │   ├── notifications/        Web Push, theo dõi tuyến
│   │       │   └── auth/                 Supabase Auth và quyền truy cập
│   │       ├── shared/
│   │       │   ├── ui/                   Button, Input, Select, Textarea, Icon, SheetPanel, Popover
│   │       │   ├── styles/               tokens.css, base.css, components.css
│   │       │   ├── i18n/                 Provider, Translator, locales/en.ts
│   │       │   └── api/ async/ format/ geo/ hooks/ text/
│   │       └── testing/                  Fixture cho test
│   └── api/
│       ├── data/osm/                     Dữ liệu đồ thị OSM
│       └── src/
│           ├── app.ts                    Entry Vercel
│           ├── createApp.ts              Factory Express
│           ├── main.ts                   Entry local
│           ├── compositionRoot.ts        Khởi tạo và tiêm implementation
│           ├── config/
│           ├── modules/
│           │   ├── navigation/           Route, OSM, reroute, so sánh tuyến
│           │   ├── optimization/         Matrix + chiến lược TSP
│           │   ├── places/               Tìm địa điểm và POI
│           │   ├── route-stops/          Tìm/chèn điểm ghé, trợ lý
│           │   └── traffic/              Báo cáo, xác minh, push
│           └── shared/ testing/
├── packages/shared/
│   ├── src/
│   │   ├── schemas/                      DTO và Zod validation
│   │   ├── geo/                          Haversine dùng chung web/API
│   │   ├── text/                         Bỏ dấu và khoá tìm kiếm tiếng Việt
│   │   └── constants.ts index.ts
│   └── test/                             Test primitive, không đưa vào bản build
├── supabase/                             migrations/, ops/, repairs/
├── scripts/                              verify/, benchmark/, osm/…
├── docs/                                 architecture/, features/, guides/, reviews/…
└── .github/workflows/ci.yml
```

## Khuôn feature web

| Vị trí | Trách nhiệm |
| --- | --- |
| `api/` | Adapter HTTP gọi backend qua `HttpClient` |
| `components/` | Giao diện, sự kiện DOM, accessibility; panel chỉ lắp ghép các phần |
| `hooks/` | State/effect React, điều phối và quyền sở hữu request |
| `domain/` | Model, thuật toán, chuyển đổi và danh mục thuần; không React hoặc I/O |
| `services/` | Adapter có trạng thái/I/O: MapLibre GL, GPS, âm thanh, localStorage, cache |
| `types.ts` | Hợp đồng dữ liệu và props dùng trong feature |
| `context/` | Provider khi thực sự cần chia sẻ state (`auth`, `places`) |
| `styles/` | CSS riêng của adapter map; phần còn lại dùng utility/token chung |

Chỉ tạo thư mục khi có file. Không tạo `utils/`, `data/` hoặc thư mục rỗng để đủ khuôn. Test đặt cạnh mã chạy, trừ test package shared ở `test/` để không xuất vào `dist`.

Backend dùng `presentation → application → domain`; `application/ports` sở hữu interface I/O, `infrastructure` triển khai port. File TypeScript camelCase, lớp PascalCase, router `<module>Router.ts`.

API lưu tuyến cá nhân chưa triển khai; phạm vi và hướng phát triển nằm ở [MY_ROUTES.md](../features/MY_ROUTES.md), không giữ module README rỗng trong `src`.
