# Review kiến trúc mã nguồn và design system iMap

Ngày review: 20/11/2026. Mốc mã nguồn: merge `0dda85a` trên nhánh `main` (gộp `origin/main` `31609da`, gồm PR #9 và PR #11, với commit gỡ voice `89593c1`).

> Bản đầu của review này lấy mốc `89593c1`, là nhánh chưa có 15 commit sửa lỗi của PR #9/#11. Phần lỗi ưu tiên bên dưới đã được đối chiếu lại với mã sau khi merge; mỗi mục ghi rõ đã sửa, sửa một phần hay còn nguyên.

Dự án có nền tảng phù hợp để tiếp tục phát triển: npm workspaces, module theo tính năng, use case và provider tách biệt, TypeScript strict, schema đầu vào và CI. Nên giữ cấu trúc monorepo hiện tại, xử lý lỗi Web Push phía server và các phần còn sót của đợt sửa web trước, sau đó tách phần điều phối web và thống nhất design system theo từng bước nhỏ.

Đây là review tĩnh xuyên repository kết hợp chạy các bộ kiểm tra hiện có. Các phát hiện theo luồng mã dưới đây chưa đồng nghĩa đã tái hiện trên Supabase production hoặc trình duyệt thật. Giao diện được đánh giá từ component/CSS; độ tương phản, bố cục thực tế và âm thanh thiết bị cần được kiểm tra trên trình duyệt.

## Kết quả kiểm tra

Chạy trên mốc merge `0dda85a`:

| Kiểm tra | Kết quả |
| --- | --- |
| `prettier --check .` | Đạt |
| `eslint .` | Đạt |
| `tsc --noEmit` (web, API) | Đạt |
| `vitest run` | 37 file API / 230 test và 35 file web / 1.043 test đều đạt |
| `vite build` (web) | Đạt |
| `git diff --check` | Đạt |

Kiểm tra chạy với Node 24 có sẵn trên máy; workflow CI cấu hình Node 22. Bộ test hiện tại kiểm tra tốt nhiều thuật toán và adapter, nhưng kết quả đạt chưa xác nhận các luồng UI, DB thật hoặc Web Push hoạt động đầy đủ.

## Các lỗi ưu tiên xử lý

P1 là lỗi cần ưu tiên vì có thể mất dữ liệu, tiếp tục gửi thông báo sau đăng xuất hoặc cho phép server gọi đến đích không được kiểm soát. P2 là lỗi hành vi, độ tin cậy hoặc khả năng bảo trì cần sửa trong các đợt kế tiếp.

### Tổng hợp trạng thái

| Mục | Mức | Trạng thái | Commit sửa |
| --- | --- | --- | --- |
| Đích gửi Web Push chưa được kiểm soát | P1 | **Còn nguyên** | — |
| Lưu tuyến báo thành công giả | P1 | Đã sửa, còn sót nhỏ | `e8f6fa9` |
| Tuyến bị ghi đè vì trùng tiêu đề | P1 | Đã sửa | `858d641` |
| Đăng xuất vẫn nhận push | P1 | Đã sửa, còn sót nhỏ | `e3a06ef`, `0081220` |
| Mở/chỉnh tuyến không giữ tuỳ chọn | P2 | Sửa một phần | `8aa38d9`, `88944da`, `e3a7317`, `94b08a1` |
| Kết quả bất đồng bộ cũ ghi đè | P2 | **Còn nguyên** | — |
| Cảnh báo cạnh tuyến chặn đề xuất | P2 | Đã sửa | `b50e4c3` |
| Lịch sử địa điểm | P2 | Sửa một phần (race) | `8c40474` |
| Quota trừ trước validation | P2 | **Còn nguyên** | — |
| Timeout HTTP | P2 | **Còn nguyên** | — |
| Web Push không bảo đảm hoàn tất | P2 | **Còn nguyên** | — |
| Payload push từ service worker không kiểm tra | P2 | **Còn nguyên** (checklist 17/11 #14) | — |
| Id báo cáo không encode trong URL | P2 | **Còn nguyên** (checklist 17/11 #16) | — |

### P1 Đích gửi Web Push chưa được kiểm soát — còn nguyên

`supabase/migrations/0007_recent_places_and_route_push.sql:195` chỉ kiểm tra endpoint bắt đầu bằng `https://`. `WebPushTrafficAlertNotifier.ts:109` chuyển endpoint đó trực tiếp cho `web-push` 3.6.7, thư viện gửi HTTPS POST tới hostname/port của URL. Một thành viên có thể lưu endpoint tự chọn cùng khoá push hợp lệ và tuyến theo dõi. `find_route_watchers` chỉ loại báo cáo của chính chủ tuyến (`0007…sql:305`), nên một người có hai tài khoản tự kích hoạt được: tài khoản thứ hai gửi báo cáo trên tuyến, server sẽ gọi URL đó. Đây là blind SSRF (không trả nội dung phản hồi) khi Web Push được bật; mức truy cập thực tế phụ thuộc mạng của môi trường triển khai.

Sửa: kiểm tra endpoint ở `save_push_subscription` và ngay trước khi gửi; xác định tập push service được hỗ trợ (FCM, Mozilla autopush, Apple, Windows), chặn địa chỉ nội bộ và cổng không được phép, kết hợp giới hạn egress. Vì RPC Supabase gọi trực tiếp được, chỉ kiểm tra ở giao diện là chưa đủ. Có test từ chối endpoint ngoài chính sách mà không phát request mạng.

### P1 Lưu tuyến báo thành công giả — đã sửa, còn sót nhỏ

Đã sửa: `SavedRouteRepository.save()` trả `boolean`, `App.tsx` chỉ báo "đã lưu" khi ghi được; không còn lưu geometry, dữ liệu cũ có `plan` được rút gọn khi đọc. Có test cho storage ném lỗi.

Còn sót:

- `useSavedRoutes.ts:23` vẫn `setRoutes(next)` khi ghi thất bại, nên danh sách hiển thị tuyến vừa báo lỗi; tải lại sẽ mất. Nên giữ state cũ hoặc đánh dấu mục chưa lưu.
- `save`/`remove` dựng danh sách mới từ `routes` trong closure; hai thao tác liên tiếp trước khi render lại sẽ làm mất thao tác đầu.
- `load()` chỉ kiểm tra `origin.name` và `kind`; một mục `stops` hỏng vẫn làm `savedRouteKey()` ném lỗi ở `toFixed`.

### P1 Tuyến bị ghi đè vì trùng tiêu đề — đã sửa

`savedRouteKey` dùng loại tuyến, loại xe, objective, tránh phà và toạ độ toàn bộ điểm dừng theo thứ tự; có test cho hai loại xe và khác điểm ghé.

### P1 Đăng xuất vẫn nhận push — đã sửa, còn sót nhỏ

Đã sửa: `AuthProvider` chạy `onBeforeSignOut` trước `auth.signOut()` (tối đa 3 giây, lỗi không chặn đăng xuất). `PushSignOutCleanup` đặt trong `main.tsx` nên chạy cả ở trang chính và `/login`; xoá dòng `push_subscriptions` của chính mình qua RLS, `route_watches` tự xoá theo `on delete cascade`, rồi huỷ đăng ký push trong trình duyệt.

Còn sót:

- `webPush.ts:132` không kiểm tra `{ error }` của lệnh xoá. Trình duyệt vẫn huỷ đăng ký nên push service thường trả 410 và server tự dọn, nhưng nên ghi log lỗi.
- Việc dọn chỉ chạy khi người dùng bấm đăng xuất; phiên hết hạn, refresh token bị thu hồi hoặc đăng xuất ở tab khác (`onAuthStateChange` → `SIGNED_OUT`) không chạy. Cần quyết định có xử lý các trường hợp này hay không.

### P2 Mở/chỉnh tuyến không giữ tuỳ chọn — sửa một phần

Đã sửa: mở tuyến đã lưu giữ objective, tránh phà và điểm ghé (`savedRouteDirectionsQuery`); trợ lý thêm/bỏ điểm ghé giữ objective (tuyến "ngắn nhất" được tính lại thay vì gắn nhãn sai); link chia sẻ mã hoá điểm ghé (`via`), `by=distance`, `ferry=avoid`.

Còn sót:

- `RoutePlan` vẫn không có `avoidFerry`, và `routeApi.createPlan` không nhận tham số này. Vì vậy `addAssistantStop`/`removeAssistantStop` (`App.tsx:911`, `:925`) tính lại tuyến **không tránh phà** dù tuyến gốc có bật. Đề xuất `RoutePreferences` (objective + avoidFerry) gắn vào `RoutePlan` vẫn còn giá trị.
- Link chia sẻ chưa có tham số version; định dạng hiện tương thích ngược nhưng nên thêm trước khi đổi tiếp.

### P2 Kết quả bất đồng bộ cũ ghi đè thao tác mới — còn nguyên

`App.tsx:509` đợi reverse geocode rồi gán điểm đi/đến mà không có generation guard. Nhánh tuyến nhiều điểm của `openSavedRoute` (`App.tsx:815`) không dùng `multiPlanGeneration`; kết quả về muộn có thể đặt lại `activeRoute` sau khi người dùng đã chuyển luồng. (Checklist 17/11 #10, #11.)

Sửa: một cơ chế xác định yêu cầu hiện hành cho mỗi luồng, kết hợp AbortController ở API client. Test hai request hoàn thành theo thứ tự ngược nhau.

### P2 Cảnh báo cạnh tuyến chặn đề xuất — đã sửa

`RerouteOfferMemory` chỉ ghi nhớ sự cố nằm trên tuyến; có test. Bộ nhớ vẫn chỉ reset khi không còn tuyến (`useRouteTrafficAlert.ts:203`); việc giữ bộ nhớ khi chấp nhận đổi tuyến là hợp lý, nhưng mở một tuyến khác khi đang có tuyến sẽ không reset.

### P2 Lịch sử địa điểm — sửa một phần

Đã sửa: thao tác thêm/xoá trong lúc danh sách server đang tải được ghi lại (`pendingEdits`) và áp lại lên kết quả remote.

Còn nguyên (checklist 17/11 #9, #13):

- `recentPlaces.ts:123` và `:138` không kiểm tra `{ error }` của Supabase nên caller không biết ghi/xoá thất bại.
- `readCachedRecentPlaces()` (`:79`) chỉ kiểm tra mảng, không kiểm tra từng `Place`; cache hỏng có thể làm `recentPlaceKey()` ném lỗi.

### P2 Hạn mức bị trừ trước khi yêu cầu được chấp nhận xử lý — còn nguyên

`apps/api/src/modules/route-stops/presentation/route-stops.routes.ts:22` chạy `requireFeatureQuota` trước validation và `ConcurrencyLimiter`. Body sai hoặc instance đang đầy vẫn tiêu tốn một trong 5 lượt/phút.

Sửa: validate trước, nhận slot xử lý rồi consume quota ngay trước khi gọi provider. Test yêu cầu 400 và yêu cầu bị chặn do concurrency không trừ quota nếu đó là chính sách sản phẩm mong muốn.

### P2 Timeout HTTP chưa bao phủ đầy đủ vòng đời phản hồi — còn nguyên

`apps/web/src/shared/api/HttpClient.ts:83` trả signal của caller khi không có `AbortSignal.any`, làm mất timeout trong nhánh đó. `unwrap()` (`:95`) đọc body ngoài khối bắt lỗi transport và đổi lỗi `response.json()` thành null, nên timeout hoặc caller abort lúc tải body bị báo thành "Phản hồi API không hợp lệ" thay vì TIMEOUT/abort. (Checklist 17/11 #12.)

Sửa: gộp signal bằng AbortController có cleanup khi thiếu API tương ứng; bắt và phân loại lỗi xuyên cả fetch và đọc body. Kiểm thử có headers sớm nhưng body chậm, caller abort và môi trường thiếu `AbortSignal.any`.

### P2 Web Push chưa có bảo đảm hoàn tất sau khi trả HTTP — còn nguyên

`CreateTrafficReportUseCase.ts:19` dùng `Promise.race` chờ tối đa 4 giây nhưng không huỷ hoặc lưu lại phần gửi còn chạy. Notifier có thể gửi tới 2.000 watcher; `webPush.sendNotification` (`WebPushTrafficAlertNotifier.ts:109`) không truyền tuỳ chọn `timeout`. Nếu môi trường dừng công việc sau khi response kết thúc, một phần thông báo có thể chưa được gửi.

Sửa: timeout rõ cho từng lần gửi; nếu yêu cầu giao thông báo đáng tin cậy, dùng outbox và worker có retry/idempotency. Không coi `Promise.race` là hàng đợi bền vững.

### P2 Mục còn mở từ checklist 17/11 chưa nằm ở trên

- **#14** `App.tsx:709` ép kiểu `event.data` từ service worker rồi dùng thẳng `report`; nên kiểm tra bằng schema dùng chung trước khi đưa vào state bản đồ.
- **#16** `features/traffic/api/trafficApi.ts:40` ghép `id` vào URL không `encodeURIComponent`.
- **#17–#22** (tải lại toàn bộ báo cáo mỗi sự kiện realtime, ký lại link ảnh, RPC lịch sử mỗi lần đổi tuyến, tính lại điểm dừng mỗi lần GPS, chờ cứng 1,2 giây, kiểm tra phiên bản khi tab ẩn) vẫn mở; ưu tiên thấp hơn các mục trên.
- **#15** (MediaRecorder) đã hết hiệu lực do gỡ voice ở `89593c1`; nên đánh dấu trong checklist.

## Kiến trúc OOP và ranh giới module

### Những phần nên giữ

- Giữ `apps/web`, `apps/api`, `packages/shared`, `supabase`, `scripts`, `docs` ở cấp root.
- API đã áp dụng constructor injection, ports/adapters và strategy có mục đích. Dijkstra/A* dùng khung tìm kiếm chung; TSP có chiến lược exact/heuristic và xử lý ma trận có hướng.
- Giữ component React dạng hàm, hook nối state/effect với logic nghiệp vụ. Hàm thuần phù hợp với geometry và formatting; không cần biến mọi hàm thành class để đạt OOP. Đợt sửa PR #11 đi đúng hướng này: tách `savedRouteKey`, `toSavedRoute`, `savedRouteQuery`, `RerouteOfferMemory`, `signOutTasks` thành đơn vị thuần có test.
- Giữ test cạnh file được kiểm thử. Tạo thư mục khi có trách nhiệm thực tế cần đặt vào đó.
- Giữ xác thực server, RLS, quota nguyên tử trong Postgres, validation tại HTTP edge và adapter cho nhà cung cấp ngoài.

### Các điểm cần chuẩn hoá

| Điểm hiện tại | Ảnh hưởng | Hướng tách |
| --- | --- | --- |
| `app/App.tsx` khoảng 1.528 dòng | Trộn navigation, reroute, traffic, lưu tuyến, assistant, POI và bố cục; khó kiểm thử chuyển trạng thái | Tách hook điều phối theo luồng và component vùng giao diện; App chỉ lắp ghép |
| `LeafletMapController.ts` 851 dòng | Một adapter quản lý tile, route, POI, incident, location, label và camera | Giữ facade; tách lớp layer và camera, có vòng đời huỷ rõ |
| `TrafficReportPanel.tsx` 697 dòng, `PlaceAssistantPanel.tsx` 578 dòng | Form, tải dữ liệu, phân tích ảnh, trạng thái xử lý và JSX đi cùng nhau | Tách form/result card và hook điều khiển theo trách nhiệm |
| `shared/geo/path.ts:1` import kiểu từ feature map/places | Shared phụ thuộc ngược tính năng | Đưa kiểu toạ độ tối thiểu xuống shared hoặc dùng kiểu cấu trúc cục bộ |
| `route-stops/domain/route-geometry.ts:2` import `StopBounds` từ application | Domain phụ thuộc ngược application, dù chỉ là type | Đặt kiểu hình học trong domain/shared và để port sử dụng |
| `trafficPresentation.ts:3` lấy kiểu từ `TrafficReportPanel.tsx` | Service gắn vào component; tạo chu trình import có cạnh type bị xoá khi build | Đặt kiểu presentation ở `traffic/types.ts`; không coi đây là vòng lặp runtime |
| `RouteComparisonController` chứa cache, quota, authentication, fallback và ranking orchestration | Controller vượt trách nhiệm HTTP, import kiểu concrete `SignedRouteComparison` | Tách use case so sánh; khai báo snapshot/quota/cache port và inject implementation |
| Middleware mặc định tự tạo Supabase dependency; `app.ts` default export khởi tạo app khi import | Composition root chưa là nơi lắp ghép duy nhất; local main gọi thêm `createApp()` | Inject middleware dependency; tách entry serverless khỏi factory app |
| Nhiều phép chiếu/khoảng cách ở `shared/geo`, `navigation/domain`, `traffic/services` (PR #11 thêm một bản `roughDistanceMeters` trong `RerouteOfferMemory`) | Khác đơn vị, công thức và cách xử lý biên dễ trôi nhau | Dùng một bộ primitive hình học có test; giữ thuật toán chuyên biệt nếu ý nghĩa khác |
| `RoutePlan`, `TransportMode`, `RouteObjective`, `FeatureKey` đều ở `map/types.ts` | Navigation và shell phụ thuộc feature map chỉ để lấy model không thuộc bản đồ | Route model về navigation, panel key về app, toạ độ về shared |

Các import domain tới DTO trong `@routetwin/shared` hiện không phải import framework trực tiếp. Tuy vậy nên phân biệt wire contract với domain model khi quy tắc nghiệp vụ phức tạp hơn. Chưa cần tạo entity/class chỉ để bọc lại dữ liệu không có hành vi.

API đặt use case của optimization trực tiếp trong `application/`, trong khi các module khác dùng `application/use-cases/`. Tên file cũng dùng lẫn PascalCase và kebab-case cho các vai trò tương tự. Cần ghi một quy ước duy nhất: class/component theo PascalCase, hook theo `useXxx`, hàm/module thuần theo kebab-case; áp dụng dần khi chạm file, tránh đổi hàng loạt chỉ vì hình thức.

## Design system

Nền tảng đã có palette brand/accent/traffic, shadow, animation, breakpoint, focus-visible và reduced-motion. `SheetPanel`, `Popover`, `Icon`, `AppShell` là điểm khởi đầu tốt. Tuy nhiên phần này hiện là bộ utility và quy ước CSS phân tán, chưa thành một design system có component contract rõ.

### Màu sắc và theme

`apps/web/tailwind.config.js` khai báo palette nhưng component, CSS và renderer bản đồ vẫn tự ghi màu. Quét nguồn web ghi nhận gần 80 giá trị hex khác nhau. Đây là dấu hiệu cần kiểm kê ý nghĩa màu; số lượng màu tự nó chưa chứng minh giao diện sai.

`app/styles.css` có 14 selector substring dạng `[class*='dark:bg-slate-900']`. Chúng cũng khớp utility có alpha như `dark:bg-slate-900/95`, khiến màu solid ghi đè ý định opacity. Các quy tắc tương tự làm palette thực tế lệch khỏi Tailwind config.

Tạo token ngữ nghĩa bằng CSS variable: `surface`, `surface-elevated`, `text-primary`, `text-secondary`, `border`, `action-primary`, `focus-ring`, `status-success/warning/danger`, `route-primary/alternative`, `traffic-*`. Ánh xạ Tailwind và renderer Leaflet vào cùng token; theme thay giá trị variable. Loại bỏ selector dò chuỗi class.

### Component dùng chung

Có 114 thẻ `<button>` trong 31 file TSX, trong khi `shared/components` hiện chỉ có Icon. Nút chính/phụ, icon button, chip, field và thông báo trạng thái đang tự lặp class ở nhiều nơi. Cần tạo các primitive thực tế được dùng lại: `Button`, `IconButton`, `Input`, `Select`, `TextArea`, `Badge`, `Alert`, `Spinner` và `EmptyState`.

Mỗi primitive cần thống nhất variant, kích thước, focus, disabled, loading và tên truy cập. `SheetPanel`/`Popover` có thể chuyển phần trung lập về shared UI; phần nối với `useShell` vẫn thuộc app. Chưa cần tạo một package UI riêng khi chỉ có một ứng dụng web sử dụng.

### Typography và vùng tương tác

Nguồn JSX dùng `text-[11px]` khoảng 150 lần cùng các cỡ chữ tuỳ ý khác. Cần định nghĩa scale nhỏ có mục đích cho heading/body/caption/label; kiểm tra khả năng đọc trên điện thoại. Icon button 36 px xuất hiện ở SheetPanel; cân nhắc mở vùng hit lên khoảng 44 px ở touch UI và xác minh khoảng cách với nút cạnh nhau.

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
- `docs/architecture/ARCHITECTURE.md:60` còn nói Matrix/TSP và OSM A* cần triển khai dù đã có mã và test. Quy tắc “toàn bộ logic không thuộc giao diện nằm trong lớp” cũng cần chỉnh thành quy tắc chọn class/hàm theo trách nhiệm.
- Review web 17/11 là checklist đang dùng: #1–#8 đã đánh dấu xong, #9–#28 còn mở, #15 hết hiệu lực do gỡ voice. Review này không thay checklist đó; khi sửa một mục ở đây thì đánh dấu cả mục tương ứng bên đó.

## Thứ tự chuẩn hoá

1. Sửa SSRF Web Push (P1 còn lại), sau đó request cũ ghi đè, lỗi Supabase bị bỏ qua (lịch sử địa điểm, xoá push), `avoidFerry` khi trợ lý thêm/bỏ điểm ghé và trạng thái danh sách khi lưu tuyến thất bại. Mỗi thay đổi kèm kiểm thử hành vi có thể thất bại trước khi sửa.
2. Quota route-stops, timeout HTTP, timeout/outbox Web Push, payload push và encode id (checklist #14, #16).
3. Đưa model route/toạ độ/panel về đúng chủ sở hữu; sửa import ngược; thêm kiểm tra boundary. Tách use case so sánh tuyến khỏi controller.
4. Tách `App.tsx` theo các luồng điều phối; sau đó tách map layers và form lớn. Mỗi bước giữ API công khai hẹp và chạy lại bộ kiểm tra phù hợp.
5. Tạo token và primitive UI; chuyển từng nhóm màn hình, bỏ theme selector substring, kiểm tra desktop/mobile/light/dark/bàn phím bằng trình duyệt.
6. Đồng bộ tài liệu kiến trúc với mã, bổ sung typecheck test/scripts và E2E cho luồng chính. Hoàn tất khi clean install, format, lint, typecheck, tests và build qua CI, cùng các kịch bản UI đã xác minh.

## Phần đã dọn trong đợt này

Commit `89593c1` ghi nhận nhóm thay đổi gỡ nhận dạng giọng nói, thêm âm thanh dẫn đường và test liên quan. Đã xoá 35 mục dịch nhận dạng giọng nói không còn tham chiếu, sửa hướng dẫn còn quảng bá voice input và thông tin quota cũ, chuẩn hoá định dạng 4 file. Các file runtime voice cũ và script kiểm tra deployment voice đã được xoá trong cùng commit.

Không có file draft/backup/temp độc lập phù hợp để xoá trong cây dự án đã quét. `DraftStops` và bản nháp hành trình là model đang được ứng dụng sử dụng. Benchmark giọng nói và các review cũ được giữ như tài liệu lịch sử. Chưa thực hiện đợt tái cấu trúc chức năng hoặc đổi cây thư mục lớn; các mục chưa sửa ở trên là backlog cho đợt chuẩn hoá tiếp theo.
