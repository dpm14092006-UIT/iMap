# Cấu trúc thư mục

```text
iMap/
├── apps/
│   ├── web/                              React + Vite + Tailwind
│   │   ├── public/                       Service worker, icon, manifest
│   │   └── src/
│   │       ├── main.tsx                  Entry point
│   │       ├── app/                      Shell: App.tsx, layout/, components/, hooks/
│   │       ├── features/
│   │       │   ├── auth/                 Supabase Auth: context, form đăng nhập
│   │       │   ├── map/                  Leaflet MapView, lớp nền, hợp đồng TrafficMapLayer
│   │       │   ├── places/               Tìm kiếm VietMap, địa điểm gần đây
│   │       │   ├── explore/              Tìm địa điểm quanh vị trí / dọc tuyến
│   │       │   ├── navigation/           Chỉ đường, dẫn đường, GPS thật/giả, so sánh tuyến
│   │       │   ├── multi-stop/           Lập kế hoạch nhiều điểm (Held–Karp, NN + 2-opt)
│   │       │   ├── my-routes/            Tuyến đã lưu (localStorage)
│   │       │   ├── traffic/              Báo cáo giao thông, ảnh, cảnh báo trên tuyến
│   │       │   ├── notifications/        Web Push, theo dõi tuyến
│   │       │   └── place-assistant/      Trợ lý địa điểm, voice
│   │       └── shared/                   api/ (HttpClient), components/, geo/, hooks/, i18n/, text/
│   └── api/                              Express + TypeScript
│       ├── data/osm/                     Đồ thị OSM trung tâm TP.HCM (Dijkstra/A*)
│       └── src/
│           ├── main.ts                   Entry point
│           ├── app.ts                    Express middleware và routes
│           ├── composition-root.ts       Dependency injection
│           ├── config/                   Đọc và kiểm tra biến môi trường
│           ├── modules/
│           │   ├── places/               VietMap search, POI quanh/dọc tuyến
│           │   ├── navigation/           VietMap Route, đồ thị OSM, Dijkstra/A*, reroute, so sánh tuyến
│           │   ├── optimization/         Matrix + chiến lược TSP
│           │   ├── route-stops/          Tìm và chèn điểm ghé theo chi phí thật
│           │   ├── traffic/              Báo cáo, xác minh cộng đồng, push
│           │   ├── voice/                Whisper speech-to-text
│           │   └── my-routes/            Chỉ có README (API chưa triển khai)
│           ├── shared/                   http/, errors/, supabase/, geo/, text/, async/
│           └── testing/                  Helper dùng chung cho test
├── packages/shared/src/                  DTO, Zod schemas, types; constants.ts là hằng số thuần
├── supabase/
│   ├── migrations/                       0001–0008, chạy theo thứ tự số
│   ├── ops/                              SQL vận hành (cron hết hạn báo cáo)
│   └── repairs/                          SQL sửa lỗi một lần cho DB đã chạy migration cũ
├── scripts/                              benchmark/, osm/, voice/ (xem scripts/README.md)
├── docs/                                 Tài liệu, mục lục ở docs/README.md
├── assets/                               Ảnh/diagram có quyền sử dụng
├── .github/workflows/ci.yml              format → lint → typecheck → test → build
├── run.sh                                Chạy web + API trên Mac
└── package.json                          npm workspaces
```

## Quy ước thư mục trong một feature web

| Thư mục | Chứa gì |
|---|---|
| `components/` | Component React (`.tsx`) |
| `hooks/` | Custom hook (`useXxx.ts`) |
| `api/` | Hàm/class gọi backend qua `shared/api/HttpClient` |
| `services/` | Logic thuần và adapter trình duyệt (GPS, storage, Leaflet) |
| `domain/` | Mô hình nghiệp vụ không phụ thuộc React |
| `context/` | React context provider |
| `data/` | Dữ liệu tĩnh (danh mục, địa điểm mẫu) |
| `utils/` | Hàm định dạng/hiển thị nhỏ |
| `types.ts` | Kiểu dùng trong feature |

Test đặt cạnh file được test (`xxx.test.ts`). Chỉ tạo thư mục khi có file.

AI không có feature riêng: phân tích ảnh sự cố và biển báo nằm trong form Báo cáo giao thông. Backend xác thực token Supabase trong `shared/http`; chưa có module `auth` riêng. Các thư mục chỉ có README ghi rõ phạm vi là khung cho phần chưa triển khai, không phải mã chạy.

## Quy tắc module backend

`domain` không phụ thuộc framework/SDK; `application` chứa use case và ports; `infrastructure` triển khai provider/repository; `presentation` xử lý HTTP và schema validation. Chỉ khởi tạo folder khi có mã thực tế cần đặt vào đó.
