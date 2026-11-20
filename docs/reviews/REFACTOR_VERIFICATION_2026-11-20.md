# Rà soát sau tái cấu trúc và test hồi quy

Ngày kiểm tra: 20/11/2026. Đối chiếu cây làm việc với `HEAD=034a9ff`; giữ nguyên phần staged và các thay đổi chưa commit của Claude. Các sửa lỗi và test trong đợt này nằm trên cây làm việc, chưa commit hoặc push.

Claude đã cải thiện cách phân chia trách nhiệm: `App.tsx` từ 1.559 còn 697 dòng, luồng điều phối chuyển vào `app/hooks`, geometry/formatting chuyển về shared, model tuyến về navigation và use case so sánh tuyến được tách khỏi controller. Đây là tiến bộ về cấu trúc. Việc tách file vẫn để lại lỗi vòng đời request, phạm vi bộ nhớ và thao tác xảy ra trước lần render kế tiếp; bộ test cũ chưa phát hiện các lỗi này.

## Kết quả xác minh

| Chỉ tiêu | Trước đợt kiểm tra này | Sau sửa |
| --- | --- | --- |
| API | 235 test / 38 file | 257 test / 40 file |
| Web | 1.117 test / 49 file | 1.169 test / 59 file |
| Tổng | 1.352 test | **1.426 test**, thêm **74 ca** |
| Chuỗi 350 lần di chuyển camera | **352** lần gọi danh sách trong fixture | **Không quá 4** lần gọi trong cùng fixture |

Lệnh `npm run verify -- --shuffle=2` đạt toàn bộ: Prettier, ESLint với zero warnings, typecheck mã sản phẩm và test, kiểm toán export/import, kiểm toán props JSX, toàn bộ test, hai lượt xáo trộn thứ tự với seed `1000` và `8919`, build API và web. Số test được tính một lần; không cộng các lượt chạy xáo trộn thành test mới.

Các test React mới chạy bằng React Testing Library và jsdom, có kiểm tra StrictMode, fake timers, Promise điều khiển thứ tự hoàn tất và mount/unmount thật của hook/provider. Bổ sung hai dependency phát triển, khoá phiên bản trong package và lockfile. Runtime kiểm tra trên máy là Node 24.21.0; chưa chạy lại CI từ máy sạch với Node 22.

## Các lỗi đã tái hiện và sửa

| Mức | Phát hiện | Điều chỉnh và test bảo vệ |
| --- | --- | --- |
| P1 | Hai lần lưu trước một lần render làm mất tuyến lưu trước; save rồi remove có thể phục hồi snapshot cũ | `useSavedRoutes` đọc danh sách mới nhất qua ref, ghi storage ngoài state updater. Test lưu liên tiếp, save/remove, storage lỗi và StrictMode không ghi hai lần |
| P1 | Kết quả `getSession()` chậm khôi phục tài khoản cũ sau SIGNED_OUT hoặc thay tài khoản mới | `AuthProvider` ưu tiên auth event đã nhận, không áp kết quả bootstrap cũ; bỏ callback sau unmount. Bốn ca kiểm tra thành công, thất bại và đổi thứ tự event |
| P1 | Đề xuất tránh sự cố của tuyến A có thể được nhận sau khi bản đồ đã sang tuyến B | `useRouteTrafficAlert` huỷ request và cảnh báo theo id tuyến, kiểm tra nguồn tuyến trước khi nhận; test chuyển trực tiếp A → B trong lúc chờ |
| P2 | Bấm nhận đề xuất hai lần trong cùng nhịp render gọi parent hai lần | Khóa quyết định đồng bộ qua ref trước callback; đồng thời kiểm tra deadline. Test nhận hai lần và hết hạn |
| P2 | Bộ nhớ phiên bản báo cáo tồn tại xuyên chuyến, làm báo cáo cũ không cảnh báo lại trong chuyến mới | `useRealtimeRouteReports` tạo scope theo id tuyến; không đánh dấu đã xử lý khi chưa có handler. Test đổi tuyến trực tiếp, đóng/mở chuyến, version mới và sự kiện trùng |
| P2 | Tối ưu nhiều điểm hoàn tất sau unmount vẫn áp tuyến và hiện toast | Huỷ generation khi cleanup. Test unmount, đổi panel, hai response ngược thứ tự và StrictMode |
| P2 | Hai lời gọi tính lại tuyến trong cùng nhịp render cùng gọi API; lỗi của chuyến cũ vẫn hiện sau khi chuyển tuyến | `useNavigationRerouting` có khóa request đồng bộ và generation theo vòng đời tuyến. Test gọi chồng, unmount, lỗi cũ và dừng dẫn đường |
| P2 | Tra điểm sau unmount vẫn sửa directions; kết quả GPS bị bỏ qua nhưng vẫn kéo camera về vị trí cũ | `useEndpointPicker` chặn thao tác khi đã unmount hoặc lựa chọn không còn hiện hành. Test kênh origin/destination độc lập và thao tác chọn tay xen giữa |
| P2 | Timer focus chưa dọn khi unmount; timer cũ thực hiện điểm mới trước thời gian chờ của điểm đó | `useMapViewport` quản lý một timer focus, huỷ khi thay điểm hoặc cleanup. Test dùng thời gian giả |
| P2 | Đổi trực tiếp giữa hai tài khoản đang đăng nhập không ghi điểm tuyến hiện tại cho tài khoản mới | Scope chống ghi trùng gồm callback record theo tài khoản. Test đổi account và thay phương án tuyến cùng điểm đầu/cuối |
| P2 | Request ký URL ảnh cũ hết hạn rồi thất bại xoá nhầm entry mới của cùng ảnh | `SignedUrlCache` chỉ xoá entry nếu Promise còn là entry hiện hành. Test response null và rejection cũ đến sau request thay thế |
| P2 | Cleanup đăng xuất ném lỗi đồng bộ thoát khỏi `Promise.allSettled`, có thể chặn đăng xuất | Chuẩn hoá từng callback qua Promise trước khi chạy. Test một callback throw đồng bộ và callback còn lại vẫn thực hiện |
| P2 | Parser báo cáo chấp nhận NaN/version không hợp lệ; ép enum object qua String có thể ném lỗi | Kiểm tra string trực tiếp, toạ độ hữu hạn và version là số nguyên dương an toàn. Thêm chín ca dữ liệu biên |
| P2 | Luật domain web ghi đè luật feature khiến domain import được app; hai hướng import API được tài liệu cấm nhưng chưa có rule | Bổ sung luật và mười ca test dùng ESLint thật, gồm cả import hợp lệ. Ba hướng import sai đã được tái hiện là không bị chặn trước sửa |
| P2 | `verify --only=typo` hoặc `--shuffle=0` có thể bỏ qua vòng kiểm tra nhưng báo tất cả đạt | Validate tên option, tên vòng và số lượt shuffle; tám ca CLI chạy process thật yêu cầu exit 2 khi đầu vào sai |

Các phát hiện được phân loại theo hành vi tái hiện trên cây hiện tại, không quy kết toàn bộ là lỗi do Claude tạo ra. Một số đã có trước tái cấu trúc nhưng trước đây thiếu test ở cấp hook/provider.

## Lỗi tải giao thông khi bản đồ bám GPS

Nguyên nhân là `LeafletMapController` phát bounds sau `moveend`; `useTrafficReports` debounce 350 ms rồi thay query bằng bounds mới. Khi camera dịch chuyển cách nhau hơn 350 ms, mỗi lần dịch đều trở thành một lần tải. Debounce chỉ gộp sự kiện sát nhau, không tái sử dụng dữ liệu của vùng đã lấy.

Đã thêm vùng tải có đệm qua `trafficQueryBounds`. Camera nằm trong vùng đó thì giữ nguyên query, nên không phát request mới; rời vùng hoặc zoom vào đáng kể thì lấy vùng mới. Query vẫn nằm trong miền toạ độ hợp lệ và giới hạn hai độ của RPC. Đổi access token vẫn tải lại để áp đúng quyền dữ liệu.

RPC hiện chỉ trả tối đa 200 bản ghi. Nếu vùng đệm chạm trần này, app lấy lại đúng viewport và tạm không mở rộng truy vấn trong khu vực đó; khi rời khu đông báo cáo sẽ dùng đệm trở lại. Cách này ưu tiên không để báo cáo ngoài màn hình chiếm hết kết quả. **Ngân sách không quá 4 request chỉ được xác nhận cho fixture 350 bước đang có, không phải giới hạn cứng ở mọi khu vực hoặc tốc độ di chuyển.** Khu vực chạm trần 200 bản ghi vẫn có thể tải thường xuyên và cần thiết kế pagination hoặc chính sách tải riêng nếu lưu lượng thực tế cao.

Tám ca test của `useTrafficReports.test.ts` kiểm tra: ngân sách 350 bước, pan ra ngoài vùng, zoom vào, giới hạn địa lý, đổi tài khoản, response cũ đến sau, burst realtime, chạm trần và rời vùng đông báo cáo. Burst 20 sự kiện vẫn gọi handler cảnh báo ngay 20 lần; chỉ một lần tải danh sách sau debounce.

Đây là số đo bằng test điều khiển, chưa phải lần chạy Demo trên trình duyệt thật hoặc đo lưu lượng Supabase production.

## Những phần còn mở

- **P1 Web Push SSRF:** `save_push_subscription` chỉ kiểm tra tiền tố HTTPS; notifier vẫn nhận URL đăng ký để gửi server request. Tái cấu trúc chưa thay chính sách đích gửi. Cần kiểm soát URL/egress và test từ chối địa chỉ ngoài chính sách trước khi mở rộng tính năng.
- **Quota route-stop:** vẫn consume trước validation/concurrency trong `route-stops.routes.ts`. Request sai hoặc bị instance từ chối có thể bị trừ lượt. Chưa thay chính sách quota trong đợt này.
- **Giao nhận push:** `Promise.race` chờ bốn giây chưa thay thế hàng đợi/outbox có retry; chưa xác minh giao nhận trên serverless thực tế.
- **Trợ lý và tránh phà:** luồng thêm/bỏ điểm ghé đã giữ objective tốt hơn, nhưng `avoidFerry` chưa được đưa xuyên model/API của trợ lý. Cần sửa contract hoặc thể hiện giới hạn rõ.
- **UI và design system:** chuyển Icon/Popover/SheetPanel xuống shared giúp đúng chiều phụ thuộc; token màu và bộ primitive Button/Input/Alert chưa được chuẩn hoá. Các selector theme dò chuỗi class vẫn còn.
- **Các file lớn:** chưa tách `LeafletMapController`, `TrafficReportPanel`, `PlaceAssistantPanel`, `I18nProvider`. Đây là backlog đang mở như người dùng xác nhận, không phải phần đã hoàn tất do chuyển thư mục.
- **Tài liệu review cũ:** trạng thái trong `FULL_REVIEW_2026-11-20.md` có mục chưa theo kịp code hiện tại, chẳng hạn timeout HTTP và validation service worker đã có sửa. Dùng mã và test hiện tại để quyết định backlog; báo cáo mới này ghi nhận đợt xác minh sau tái cấu trúc.
- **Giới hạn kiểm thử:** chưa kiểm tra giao diện bản đồ, âm thanh/GPS trên thiết bị, RLS với DB thật, provider trả phí hoặc Web Push đầu cuối. Audit export/props xác nhận sự hiện diện, không chứng minh mọi callback nối đúng hành vi.

## Chạy lại

```sh
npm ci
npm run verify -- --shuffle=2
```

Chạy riêng ca chống request dồn khi camera di chuyển:

```sh
npm run test -w @routetwin/web -- src/features/traffic/hooks/useTrafficReports.test.ts
```

Nếu đã commit tái cấu trúc vào nhánh `main`, cần truyền `--base=<commit-trước-tái-cấu-trúc>` để audit còn so với mốc cũ; mặc định `--base=main` chỉ so với nhánh main hiện hành.
