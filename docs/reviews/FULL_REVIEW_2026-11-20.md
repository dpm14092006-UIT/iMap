# Review kiến trúc mã nguồn và design system iMap

Ngày review: 20/11/2026. Mốc mã nguồn: `89593c1` trên nhánh `main`.

Dự án có nền tảng phù hợp để tiếp tục phát triển: npm workspaces, module theo tính năng, use case và provider tách biệt, TypeScript strict, schema đầu vào và CI. Nên giữ cấu trúc monorepo hiện tại, sửa các lỗi mất dữ liệu và vòng đời phiên trước, sau đó tách phần điều phối web và thống nhất design system theo từng bước nhỏ.

Đây là review tĩnh xuyên repository kết hợp chạy các bộ kiểm tra hiện có. Đã quét dependency của toàn bộ 226 file TypeScript/TSX sản phẩm, gồm 100 file API, 117 file web và 9 file shared; đối chiếu các luồng chính, cấu hình, migration, tài liệu và 65 file test. Các phát hiện theo luồng mã dưới đây chưa đồng nghĩa đã tái hiện trên Supabase production hoặc trình duyệt thật. Giao diện được đánh giá từ component/CSS; độ tương phản, bố cục thực tế và âm thanh thiết bị cần được kiểm tra trên trình duyệt.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run format:check` | Đạt sau khi chuẩn hoá 4 file |
| `npm run lint` | Đạt |
| `npm run typecheck` | Đạt |
| `npm test` | 37 file API / 230 test và 28 file web / 1.012 test đều đạt |
| `npm run build` | Đạt; Rollup còn cảnh báo annotation trong dependency Zod |
| `git diff --check` | Đạt |
| Quét 662 import tương đối trong mã sản phẩm | Không thiếu file đích |

Kiểm tra chạy với Node 24.21.0 có sẵn trên máy; workflow CI cấu hình Node 22. Bộ test hiện tại kiểm tra tốt nhiều thuật toán và adapter, nhưng kết quả đạt chưa xác nhận các luồng UI, DB thật hoặc Web Push hoạt động đầy đủ.

## Các lỗi ưu tiên xử lý

P1 là lỗi cần ưu tiên vì có thể mất dữ liệu, tiếp tục gửi thông báo sau đăng xuất hoặc cho phép server gọi đến đích không được kiểm soát. P2 là lỗi hành vi, độ tin cậy hoặc khả năng bảo trì cần sửa trong các đợt kế tiếp.

### P1 Lưu tuyến có thể mất dữ liệu mà vẫn báo thành công

`apps/web/src/features/my-routes/services/SavedRouteRepository.ts:25` bắt và bỏ lỗi ghi localStorage. `useSavedRoutes.ts:38` ghi trong effect, trong khi `apps/web/src/app/App.tsx:779` báo thành công ngay sau cập nhật state. Khi hết dung lượng hoặc storage bị chặn, người dùng vẫn thấy đã lưu nhưng tải lại sẽ mất tuyến. Repository còn serialize cả geometry, làm dung lượng tăng nhanh.

Sửa: lưu định nghĩa hành trình gọn gồm điểm, phương tiện và tuỳ chọn; tính lại geometry khi mở. Trả kết quả ghi rõ ràng cho hook và chỉ báo thành công sau khi lưu được. Thêm kiểm thử storage ném `QuotaExceededError` và storage không khả dụng.

### P1 Các tuyến khác nhau bị ghi đè vì trùng tiêu đề

`apps/web/src/features/my-routes/hooks/useSavedRoutes.ts:45` bỏ trùng bằng `title`. A → B ô tô và A → B xe máy có cùng tên; hai hành trình nhiều điểm cùng điểm xuất phát và cùng số điểm cũng có thể cùng tên.

Sửa: dùng khoá nghiệp vụ từ danh sách điểm có thứ tự, phương tiện, mục tiêu và tuỳ chọn tránh đường. Tiêu đề chỉ dùng hiển thị. Kiểm tra lưu hai loại xe và hai hành trình khác điểm ghé vẫn giữ đủ mục.

### P1 Đăng xuất chưa huỷ theo dõi tuyến và đăng ký push

`apps/web/src/features/auth/context/AuthProvider.tsx:76` chỉ gọi `auth.signOut()`. `usePushNotifications.ts` xoá endpoint khỏi state; cleanup của `useRouteWatch.ts` chỉ dừng timer. Bản ghi server còn hiệu lực đến khi hết hạn, nên thiết bị dùng chung có thể tiếp tục nhận cảnh báo của phiên trước trong thời gian đó.

Sửa: dọn bản ghi theo dõi và đăng ký của tài khoản trước khi xoá phiên; dùng quyền DELETE/RLS hiện có hoặc RPC dành cho chính chủ. RPC `delete_push_subscription` hiện tại chỉ cấp cho `service_role`, không gọi trực tiếp RPC này từ client. Định nghĩa rõ cách xử lý lỗi dọn dẹp và trường hợp đổi tài khoản.

### P1 Đích gửi Web Push chưa được kiểm soát

`supabase/migrations/0007_recent_places_and_route_push.sql:195` chỉ kiểm tra endpoint bắt đầu bằng `https://`. `WebPushTrafficAlertNotifier.ts:109` chuyển endpoint đó trực tiếp cho `web-push`; phiên bản thư viện đang cài gửi HTTPS tới hostname/port của URL. Một thành viên có thể lưu endpoint tự chọn cùng khoá push hợp lệ và tuyến theo dõi; khi có báo cáo của người khác khớp tuyến, server sẽ gọi URL đó. Đây là đường đi có nguy cơ SSRF khi Web Push được bật; mức truy cập thực tế phụ thuộc mạng của môi trường triển khai.

Sửa: kiểm tra endpoint ở nơi đăng ký và ngay trước khi gửi; xác định tập push service được hỗ trợ, chặn địa chỉ nội bộ và cổng không được phép, kết hợp giới hạn egress. Vì RPC Supabase gọi trực tiếp được, chỉ kiểm tra ở giao diện là chưa đủ. Có test từ chối endpoint ngoài chính sách mà không phát request mạng.

### P2 Mở và chỉnh tuyến không giữ đầy đủ tuỳ chọn

`App.tsx:789` mở tuyến đã lưu hai điểm nhưng không truyền `objective` và `avoidFerry` vào `directions.open()`. Model `RoutePlan` hiện cũng không giữ `avoidFerry`. `App.tsx:897` và `:913` thêm/bỏ điểm ghé trợ lý không truyền objective vào hàm dựng/tính tuyến, nên mặc định về `time`. Backend tìm điểm ghé hiện cố định tối ưu theo thời gian.

Sửa: tạo một model `RoutePreferences`, truyền xuyên suốt calculate/save/open/share/reroute/assistant. Nếu trợ lý chỉ hỗ trợ mục tiêu thời gian, cần thể hiện ràng buộc này hoặc mở rộng contract; không chỉ đổi nhãn objective của geometry đã tính.

`features/navigation/services/routeShareLink.ts` chỉ mã hoá điểm đầu/cuối và loại xe, nên link chia sẻ cũng mất điểm ghé, mục tiêu và tránh phà. Cần version định dạng link và kiểm thử khôi phục toàn bộ hành trình.

### P2 Kết quả bất đồng bộ cũ có thể ghi đè thao tác mới

`App.tsx:501` đợi reverse geocode rồi gán điểm mà không có cancellation/generation guard. `App.tsx:789` mở tuyến nhiều điểm đã lưu cũng không dùng cơ chế `multiPlanGeneration` đang có ở luồng tối ưu. Kết quả về muộn có thể thay điểm/tuyến sau khi người dùng đã đổi lựa chọn hoặc chuyển luồng.

Sửa: dùng một cơ chế xác định yêu cầu hiện hành cho mỗi luồng và AbortController ở API client. Test hai request hoàn thành theo thứ tự ngược nhau.

### P2 Một cảnh báo cạnh tuyến có thể chặn đề xuất tránh sự cố trên tuyến

`features/traffic/hooks/useRouteTrafficAlert.ts:158` thêm mọi sự cố vào `offered`, kể cả khi `onRoute` là false. Hàm kiểm tra đã đề xuất gộp sự cố trong 80 m. Vì vậy sự cố ngoài tuyến ở sát biên hành lang có thể làm sự cố mới nằm trên tuyến không được đề xuất đường tránh.

Sửa: chỉ ghi nhận đã đề xuất khi sự cố đủ điều kiện trên tuyến; reset bộ nhớ theo chuyến đi. Hiện bộ nhớ chỉ reset khi không còn tuyến, nên cần xét cả việc đổi chuyến trực tiếp.

### P2 Lịch sử địa điểm có race và bỏ qua lỗi ghi

`features/places/context/RecentPlacesProvider.tsx:50` thay state bằng kết quả remote, kể cả khi người dùng vừa thêm/xoá local trong lúc tải. `services/recentPlaces.ts:97` và `:112` không kiểm tra trường `error` của Supabase nên caller không nhận được lỗi ghi/xoá. `readCachedRecentPlaces()` chỉ kiểm tra mảng, không kiểm tra từng `Place`; dữ liệu cache sai có thể làm `recentPlaceKey()` ném lỗi khi đọc `name` hoặc toạ độ.

Sửa: kiểm tra schema và version dữ liệu cache, dùng revision hoặc merge có xử lý xoá để tránh ghi đè thao tác mới; xử lý `{ error }` của SDK. Kiểm thử tải remote chậm, dữ liệu hỏng và RPC thất bại.

### P2 Hạn mức bị trừ trước khi yêu cầu được chấp nhận xử lý

`apps/api/src/modules/route-stops/presentation/route-stops.routes.ts:22` chạy quota trước validation và kiểm tra concurrency. Body sai hoặc instance đang đầy vẫn có thể tiêu tốn một trong 5 lượt/phút.

Sửa: validate trước, nhận slot xử lý rồi consume quota ngay trước khi gọi provider. Test yêu cầu 400 và yêu cầu bị chặn do concurrency không trừ quota nếu đó là chính sách sản phẩm mong muốn.

### P2 Timeout HTTP chưa bao phủ đầy đủ vòng đời phản hồi

`apps/web/src/shared/api/HttpClient.ts:78` trả signal của caller khi không có `AbortSignal.any`, làm mất timeout trong nhánh đó. `unwrap()` đọc body ngoài khối bắt lỗi transport và đổi lỗi `response.json()` thành null, nên timeout lúc tải body bị báo thành phản hồi không hợp lệ thay vì TIMEOUT.

Sửa: gộp signal bằng AbortController có cleanup khi thiếu API tương ứng; bắt và phân loại lỗi xuyên cả fetch và đọc body. Kiểm thử có headers sớm nhưng body chậm, caller abort và môi trường thiếu `AbortSignal.any`.

### P2 Web Push chưa có bảo đảm hoàn tất sau khi trả HTTP

`CreateTrafficReportUseCase.ts:19` dùng `Promise.race` chờ tối đa 4 giây nhưng không huỷ hoặc lưu lại phần gửi còn chạy. Notifier có thể gửi tới 2.000 watcher, mỗi request gửi chưa đặt timeout. Nếu môi trường dừng công việc sau khi response kết thúc, một phần thông báo có thể chưa được gửi.

Sửa: timeout rõ cho từng lần gửi; nếu yêu cầu giao thông báo đáng tin cậy, dùng outbox và worker có retry/idempotency. Không coi `Promise.race` là hàng đợi bền vững.

## Kiến trúc OOP và ranh giới module

### Những phần nên giữ

- Giữ `apps/web`, `apps/api`, `packages/shared`, `supabase`, `scripts`, `docs` ở cấp root.
- API đã áp dụng constructor injection, ports/adapters và strategy có mục đích. Dijkstra/A* dùng khung tìm kiếm chung; TSP có chiến lược exact/heuristic và xử lý ma trận có hướng.
- Giữ component React dạng hàm, hook nối state/effect với logic nghiệp vụ. Hàm thuần phù hợp với geometry và formatting; không cần biến mọi hàm thành class để đạt OOP.
- Giữ test cạnh file được kiểm thử. Tạo thư mục khi có trách nhiệm thực tế cần đặt vào đó.
- Giữ xác thực server, RLS, quota nguyên tử trong Postgres, validation tại HTTP edge và adapter cho nhà cung cấp ngoài.

### Các điểm cần chuẩn hoá

| Điểm hiện tại | Ảnh hưởng | Hướng tách |
| --- | --- | --- |
| `app/App.tsx` khoảng 1.514 dòng | Trộn navigation, reroute, traffic, lưu tuyến, assistant, POI và bố cục; khó kiểm thử chuyển trạng thái | Tách hook điều phối theo luồng và component vùng giao diện; App chỉ lắp ghép |
| `LeafletMapController.ts` 851 dòng | Một adapter quản lý tile, route, POI, incident, location, label và camera | Giữ facade; tách lớp layer và camera, có vòng đời huỷ rõ |
| `TrafficReportPanel.tsx` 697 dòng, `PlaceAssistantPanel.tsx` 578 dòng | Form, tải dữ liệu, phân tích ảnh, trạng thái xử lý và JSX đi cùng nhau | Tách form/result card và hook điều khiển theo trách nhiệm |
| `shared/geo/path.ts:1` import kiểu từ feature map/places | Shared phụ thuộc ngược tính năng | Đưa kiểu toạ độ tối thiểu xuống shared hoặc dùng kiểu cấu trúc cục bộ |
| `route-stops/domain/route-geometry.ts:2` import `StopBounds` từ application | Domain phụ thuộc ngược application, dù chỉ là type | Đặt kiểu hình học trong domain/shared và để port sử dụng |
| `trafficPresentation.ts:3` lấy kiểu từ `TrafficReportPanel.tsx` | Service gắn vào component; tạo chu trình import có cạnh type bị xoá khi build | Đặt kiểu presentation ở `traffic/types.ts`; không coi đây là vòng lặp runtime |
| `RouteComparisonController` chứa cache, quota, authentication, fallback và ranking orchestration | Controller vượt trách nhiệm HTTP, import kiểu concrete `SignedRouteComparison` | Tách use case so sánh; khai báo snapshot/quota/cache port và inject implementation |
| Middleware mặc định tự tạo Supabase dependency; `app.ts` default export khởi tạo app khi import | Composition root chưa là nơi lắp ghép duy nhất; local main gọi thêm `createApp()` | Inject middleware dependency; tách entry serverless khỏi factory app |
| Nhiều phép chiếu/khoảng cách ở `shared/geo`, `navigation/domain`, `traffic/services` | Khác đơn vị, công thức và cách xử lý biên dễ trôi nhau | Dùng một bộ primitive hình học có test; giữ thuật toán chuyên biệt nếu ý nghĩa khác |
| `RoutePlan`, `TransportMode`, `RouteObjective`, `FeatureKey` đều ở `map/types.ts` | Navigation và shell phụ thuộc feature map chỉ để lấy model không thuộc bản đồ | Route model về navigation, panel key về app, toạ độ về shared |

Các import domain tới DTO trong `@routetwin/shared` hiện không phải import framework trực tiếp. Tuy vậy nên phân biệt wire contract với domain model khi quy tắc nghiệp vụ phức tạp hơn. Chưa cần tạo entity/class chỉ để bọc lại dữ liệu không có hành vi.

API đặt use case của optimization trực tiếp trong `application/`, trong khi các module khác dùng `application/use-cases/`. Tên file cũng dùng lẫn PascalCase và kebab-case cho các vai trò tương tự. Cần ghi một quy ước duy nhất: class/component theo PascalCase, hook theo `useXxx`, hàm/module thuần theo kebab-case; áp dụng dần khi chạm file, tránh đổi hàng loạt chỉ vì hình thức.

## Design system

Nền tảng đã có palette brand/accent/traffic, shadow, animation, breakpoint, focus-visible và reduced-motion. `SheetPanel`, `Popover`, `Icon`, `AppShell` là điểm khởi đầu tốt. Tuy nhiên phần này hiện là bộ utility và quy ước CSS phân tán, chưa thành một design system có component contract rõ.

### Màu sắc và theme

`apps/web/tailwind.config.js` khai báo palette nhưng component, CSS và renderer bản đồ vẫn tự ghi màu. Quét nguồn web ghi nhận 81 giá trị hex khác nhau. Đây là dấu hiệu cần kiểm kê ý nghĩa màu; số lượng màu tự nó chưa chứng minh giao diện sai.

`app/styles.css:492` dùng selector substring như `[class*='dark:bg-slate-900']`. Nó cũng khớp utility có alpha như `dark:bg-slate-900/95`, khiến màu solid ghi đè ý định opacity. Các quy tắc tương tự làm palette thực tế lệch khỏi Tailwind config.

Tạo token ngữ nghĩa bằng CSS variable: `surface`, `surface-elevated`, `text-primary`, `text-secondary`, `border`, `action-primary`, `focus-ring`, `status-success/warning/danger`, `route-primary/alternative`, `traffic-*`. Ánh xạ Tailwind và renderer Leaflet vào cùng token; theme thay giá trị variable. Loại bỏ selector dò chuỗi class.

### Component dùng chung

Quét 50 file TSX có 114 thẻ button, trong khi `shared/components` hiện chỉ có Icon. Nút chính/phụ, icon button, chip, field và thông báo trạng thái đang tự lặp class ở nhiều nơi. Cần tạo các primitive thực tế được dùng lại: `Button`, `IconButton`, `Input`, `Select`, `TextArea`, `Badge`, `Alert`, `Spinner` và `EmptyState`.

Mỗi primitive cần thống nhất variant, kích thước, focus, disabled, loading và tên truy cập. `SheetPanel`/`Popover` có thể chuyển phần trung lập về shared UI; phần nối với `useShell` vẫn thuộc app. Chưa cần tạo một package UI riêng khi chỉ có một ứng dụng web sử dụng.

### Typography và vùng tương tác

Nguồn JSX dùng nhiều `text-[11px]` và các cỡ chữ tuỳ ý. Cần định nghĩa scale nhỏ có mục đích cho heading/body/caption/label; kiểm tra khả năng đọc trên điện thoại. Icon button 36 px xuất hiện ở SheetPanel; cân nhắc mở vùng hit lên khoảng 44 px ở touch UI và xác minh khoảng cách với nút cạnh nhau.

### Bàn phím và focus

`Popover.tsx` khai báo `role="dialog"` nhưng không chuyển focus vào nội dung hoặc trả focus về trigger khi đóng. `SheetPanel.tsx` có xử lý ArrowUp/ArrowDown trên header, nhưng tay nắm chưa là phần tử có thể nhận focus và thao tác bàn phím trực tiếp.

Xác định rõ popover là dialog hay nhóm control; quản lý focus tương ứng. Cho bottom sheet nút/tay nắm có tên và trạng thái truy cập được. Chỉ dùng focus trap khi bề mặt thực sự modal. Bổ sung kiểm tra Tab, Shift+Tab, Escape, screen reader và trạng thái loading/error.

### Tổ chức CSS và bản dịch

`app/styles.css` đang gộp reset, shell, marker Leaflet, tooltip, route label và theme. Tách theo chủ sở hữu: shared tokens/base, app shell và map renderer styles. `I18nProvider.tsx` vẫn hơn 1.000 dòng sau cleanup; tách dictionary theo locale/feature khỏi React provider và hàm dịch thuần. Dùng khoá dịch ổn định thay cho việc phụ thuộc toàn bộ câu tiếng Việt khi mở rộng hệ thống.

## Cấu trúc thư mục đề xuất

Áp dụng dần vào thư mục hiện có; cây này biểu diễn trách nhiệm đích, không yêu cầu tạo trước mọi folder.

```text
apps/
  api/src/
    main.ts
    app.ts
    composition-root.ts
    config/
    modules/<feature>/
      domain/                   # Mô hình, quy tắc, thuật toán thuần
      application/
        use-cases/
        ports/                  # Hợp đồng I/O mà use case cần
      infrastructure/
        providers/
        repositories/
      presentation/
        controllers/
        routes/
    shared/                     # HTTP, lỗi, Supabase, geometry dùng chung
    testing/
  web/src/
    app/
      App.tsx
      providers/
      hooks/                    # Điều phối nhiều feature
      layout/
      styles/
    features/<feature>/
      components/
      hooks/
      domain/                   # Chỉ khi có nghiệp vụ độc lập UI
      api/
      services/                 # Adapter browser và dịch vụ của feature
      types.ts
      index.ts                  # API công khai nhỏ khi feature khác cần
    shared/
      ui/
      api/
      geo/
      hooks/
      i18n/
        locales/
      styles/
        tokens.css
        base.css
packages/shared/src/
  constants.ts
  schemas/                      # DTO và validation dùng chung web/API
supabase/
  migrations/
  ops/
  repairs/
scripts/
  benchmark/
  osm/
  voice/                        # Benchmark lịch sử, không phải runtime
docs/
  architecture/
  features/
  guides/
  reviews/
```

Các port do domain thực sự sở hữu có thể tiếp tục ở domain; không chuyển cơ học mọi interface vào application. Public API của feature chỉ xuất những gì bên ngoài cần, ưu tiên named export nhỏ. Không tạo barrel lớn rồi buộc nội bộ feature import qua barrel đó.

## Công cụ chất lượng và tài liệu

- Bổ sung quy tắc import tự động để shared không phụ thuộc features, domain không phụ thuộc application/infrastructure/presentation và feature không truy cập sâu tuỳ tiện vào feature khác. ESLint hiện chủ yếu kiểm tra cú pháp, type imports và hooks.
- Backend `tsconfig.json` loại test và helper testing khỏi typecheck; scripts cũng chưa nằm trong lệnh typecheck root. Vitest chạy thành công không thay thế kiểm tra kiểu. Thêm cấu hình typecheck cho test/scripts nếu tiếp tục duy trì chúng.
- Chưa có bộ browser E2E/component rendering trong repository. Ưu tiên kiểm thử hồi quy các luồng lưu/mở tuyến, thay request, đăng xuất/push và focus; tránh chỉ tăng số lượng ca tham số mà bỏ trống các luồng này.
- `apps/api/src/modules/my-routes/README.md` là placeholder; API `/api/my-routes` còn trả not implemented, frontend đang dùng localStorage. Giữ tài liệu phạm vi rõ, chưa cần sinh đủ tầng cho module chưa triển khai.
- `docs/architecture/ARCHITECTURE.md` còn nói Matrix/TSP và OSM A* cần triển khai dù đã có mã và test. Quy tắc “toàn bộ logic không thuộc giao diện nằm trong lớp” cũng cần chỉnh thành quy tắc chọn class/hàm theo trách nhiệm.
- Review web 17/11 là checklist lịch sử, có mục đã hết hiệu lực do gỡ voice. Giữ lịch sử và đối chiếu từng mục khi sửa; không xoá báo cáo chỉ vì chứa đường dẫn cũ.

## Thứ tự chuẩn hoá

1. Sửa các lỗi P1, sau đó lỗi giữ tuỳ chọn, request cũ và lịch sử địa điểm. Mỗi thay đổi kèm kiểm thử hành vi có thể thất bại trước khi sửa.
2. Đưa model route/toạ độ/panel về đúng chủ sở hữu; sửa import ngược; thêm kiểm tra boundary. Tách use case so sánh tuyến khỏi controller.
3. Tách `App.tsx` theo các luồng điều phối; sau đó tách map layers và form lớn. Mỗi bước giữ API công khai hẹp và chạy lại bộ kiểm tra phù hợp.
4. Tạo token và primitive UI; chuyển từng nhóm màn hình, bỏ theme selector substring, kiểm tra desktop/mobile/light/dark/bàn phím bằng trình duyệt.
5. Đồng bộ tài liệu kiến trúc với mã, bổ sung typecheck test/scripts và E2E cho luồng chính. Hoàn tất khi clean install, format, lint, typecheck, tests và build qua CI, cùng các kịch bản UI đã xác minh.

## Phần đã dọn trong đợt này

Commit `89593c1` ghi nhận nhóm thay đổi gỡ nhận dạng giọng nói, thêm âm thanh dẫn đường và test liên quan. Đã xoá 35 mục dịch nhận dạng giọng nói không còn tham chiếu, sửa hướng dẫn còn quảng bá voice input và thông tin quota cũ, chuẩn hoá định dạng 4 file. Các file runtime voice cũ và script kiểm tra deployment voice đã được xoá trong cùng commit.

Không có file draft/backup/temp độc lập phù hợp để xoá trong cây dự án đã quét. `DraftStops` và bản nháp hành trình là model đang được ứng dụng sử dụng. Benchmark giọng nói và các review cũ được giữ như tài liệu lịch sử. Chưa thực hiện đợt tái cấu trúc chức năng hoặc đổi cây thư mục lớn; các mục chưa sửa ở trên là backlog cho đợt chuẩn hoá tiếp theo.
