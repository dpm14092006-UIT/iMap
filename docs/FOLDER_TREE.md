# Cấu trúc thư mục hiện tại

```text
RouteTwin_OOP_Starter/
├── apps/
│   ├── web/src/
│   │   ├── app/                         Shell và ghép các tính năng
│   │   ├── features/
│   │   │   ├── auth/                    Supabase Auth UI/context
│   │   │   ├── map/                     Leaflet, lớp traffic, dữ liệu mẫu
│   │   │   ├── places/                  Tìm kiếm Photon/OSM
│   │   │   ├── navigation/              Gọi VietMap Route API
│   │   │   ├── multi-stop/              Lập kế hoạch nhiều điểm
│   │   │   ├── my-routes/               UI lưu localStorage; chưa có API
│   │   │   └── traffic/                 Báo cáo, ảnh, gợi ý Gemini, xác nhận
│   │   └── shared/                      API client, UI, geo và chuẩn hóa text dùng chung
│   └── api/src/
│       ├── config/                      Đọc và kiểm tra biến môi trường
│       ├── shared/                      HTTP, lỗi, Supabase client, haversine và bỏ dấu tiếng Việt
│       ├── modules/
│       │   ├── places/                  Photon provider và tìm kiếm
│       │   ├── navigation/              VietMap route, graph, Dijkstra
│       │   ├── optimization/            Strategy tối ưu và matrix port
│       │   ├── my-routes/               Tài liệu; API chưa triển khai
│       │   └── traffic/                 Domain, use cases, adapters, HTTP
│       ├── composition-root.ts           Dependency injection
│       ├── app.ts                        Express middleware/routes
│       └── main.ts                       Entry point
├── packages/shared/src/                  DTO, Zod schemas, types; `constants.ts` là hằng số thuần (web import mà không kéo zod)
├── supabase/
│   ├── migrations/                       PostGIS, Auth/RLS, ảnh, xác nhận
│   └── ops/                              SQL vận hành hạn báo cáo
├── docs/                                 Kiến trúc, API, kế hoạch, ownership
├── scripts/                              Chỗ đặt script tiện ích
├── assets/                               Tài liệu về tài sản có quyền sử dụng
├── .github/workflows/                    CI
├── run.sh                                Chạy web và API trên Mac
└── package.json                          npm workspaces
```

AI không có feature riêng: phân tích ảnh sự cố và biển báo nằm trong form Báo cáo giao thông. Backend xác thực token Supabase trong `shared/http`; chưa có module `auth` riêng. Các thư mục chỉ có README ghi rõ phạm vi là khung cho phần chưa triển khai, không phải mã chạy.

## Quy tắc module backend

`domain` không phụ thuộc framework/SDK; `application` chứa use case và ports; `infrastructure` triển khai provider/repository; `presentation` xử lý HTTP và schema validation. Chỉ khởi tạo folder khi có mã thực tế cần đặt vào đó.
