# Review code web — 17/11/2026

Phạm vi: toàn bộ `apps/web/src` (đọc kỹ phần logic: API client, hook, domain dẫn đường, bản đồ, `App.tsx`, lưu trữ, auth, push, voice; component thuần giao diện chỉ đọc lướt phần xử lý). Review một lượt, **chưa chạy thử để xác nhận từng lỗi** — người sửa nên tái hiện trước khi sửa.

Cách làm: mỗi mục sửa trong một commit riêng, ghi số mục trong commit message (vd. `fix(web): #2 khóa trùng tuyến đã lưu`), thêm test cho các mục đúng/sai logic. Đánh dấu `[x]` khi xong.

## A. Lỗi logic (ưu tiên sửa trước)

- [ ] **1. Sự cố cạnh tuyến chặn gợi ý đổi tuyến** — `features/traffic/hooks/useRouteTrafficAlert.ts:157`
  `trigger()` ghi mọi sự cố vào `offered`, kể cả sự cố *không* nằm trên tuyến (offer `clear`); `isOffered()` lại so khớp bán kính 80 m. Một báo cáo cách tuyến 150 m đến trước sẽ khiến báo cáo *trên* tuyến cách nó 60 m không bao giờ được tính đường tránh.
  _Gợi ý:_ chỉ ghi vào `offered` khi `onRoute`.

- [x] **2. Tuyến đã lưu ghi đè nhau** — `features/my-routes/hooks/useSavedRoutes.ts:45`
  Bỏ trùng theo `title`, mà title không có loại xe/điểm dừng. Lưu A→B ô tô rồi A→B xe máy thì mất bản ô tô; hai hành trình nhiều điểm cùng điểm xuất phát, cùng số điểm cũng đè nhau.
  _Gợi ý:_ khóa trùng gồm vehicle + objective + danh sách id/tọa độ các điểm.

- [x] **3. Báo "đã lưu" nhưng không lưu được** — `features/my-routes/services/SavedRouteRepository.ts:27`
  Mỗi tuyến lưu cả hình học vào localStorage; `save()` nuốt lỗi QuotaExceeded trong khi App vẫn toast "Đã lưu hành trình". Tải lại trang là mất.
  _Gợi ý:_ không lưu `plan.legs[].points` (đã tính lại khi mở), và `save()` trả về thành công/thất bại để App báo đúng.

- [ ] **4. Link chia sẻ mất điểm dừng và tiêu chí** — `features/navigation/components/RouteShareBar.tsx:19`, `services/routeShareLink.ts`
  Chỉ mã hóa from/to/mode; mất waypoints, objective (nhanh/ngắn nhất), avoidFerry.

- [ ] **5. Mở lại tuyến đã lưu bị đổi tiêu chí** — `app/App.tsx:788`
  `openSavedRoute()` không truyền `objective`/`avoidFerry` của tuyến đã lưu vào `directions.open()`.

- [ ] **6. Thêm/bỏ điểm ghé bằng trợ lý reset tiêu chí về "time"** — `app/App.tsx:888`, `app/App.tsx:900`
  `routePlanFromResult(...)` và `routeApi.createPlan(...)` thiếu `activeRoute.objective`.

- [ ] **7. Lịch sử địa điểm mất mục vừa thêm** — `features/places/context/RecentPlacesProvider.tsx:50`
  Kết quả `repository.list()` về sau `record()` sẽ ghi đè state và cache.
  _Gợi ý:_ gộp remote với các mục local mới hơn, hoặc bỏ qua kết quả list nếu đã có record trong lúc chờ.

- [ ] **8. Đăng xuất vẫn nhận push** — `features/notifications/hooks/usePushNotifications.ts:51`, `hooks/useRouteWatch.ts:49`
  Khi đăng xuất chỉ xóa endpoint ở state; đăng ký push và `route_watches` trên server vẫn còn → máy dùng chung tiếp tục nhận cảnh báo tuyến của người trước.
  _Gợi ý:_ trước khi `signOut`, gọi `delete_push_subscription` + `deleteRouteWatch(endpoint)`.

- [ ] **9. Lỗi Supabase khi ghi lịch sử bị bỏ qua** — `features/places/services/recentPlaces.ts:100`, `:115`
  `rpc()`/`.delete()` trả `{ error }` chứ không throw, nên `.catch()` ở nơi gọi không bao giờ chạy.

- [ ] **10. Chọn điểm trên bản đồ bị kết quả cũ ghi đè** — `app/App.tsx:504`
  `placeFromPoint` (reverse geocode, timeout 45 s) không hủy/không đánh số request; chọn nhanh hai lần thì lần chậm về sau thắng.

- [ ] **11. Mở lại hành trình nhiều điểm không chống kết quả cũ** — `app/App.tsx:799`
  Sau `await createPlan` luôn `setActiveRoute` + đóng panel, kể cả khi người dùng đã sang tuyến khác (khác với `planMultiStopRoute` có `multiPlanGeneration`).

- [ ] **12. Mất timeout trên Safari cũ** — `shared/api/HttpClient.ts:83`
  Khi có `signal` mà trình duyệt chưa có `AbortSignal.any` (iOS < 17.4), timeout 45 s bị bỏ → request treo, UI quay mãi.
  _Gợi ý:_ tự gộp hai signal bằng một AbortController khi thiếu `AbortSignal.any`.

- [ ] **13. Cache lịch sử không kiểm tra kiểu** — `features/places/services/recentPlaces.ts:61`
  Phần tử thiếu `name`/`lat` trong localStorage làm `recentPlaceKey()` throw → crash app.

- [ ] **14. Payload push từ service worker không được kiểm tra** — `app/App.tsx:691`
  Dùng lại `parseRealtimeReport` (đang có trong `useTrafficReports.ts`) trước khi gọi `onRealtimeTrafficReport`.

- [ ] **15. Lỗi khởi tạo MediaRecorder báo nhầm là thiếu quyền micro** — `features/place-assistant/hooks/useApiSpeechDraft.ts:112`

- [ ] **16. Id báo cáo không encode trong URL** — `features/traffic/api/trafficApi.ts:40`
  Dùng `encodeURIComponent(id)`.

## B. Hiệu năng

- [ ] **17. Mỗi sự kiện realtime tải lại toàn bộ báo cáo** — `features/traffic/hooks/useTrafficReports.ts:108`
  Gom các sự kiện (debounce ~500 ms) trước khi `refresh()`.
- [ ] **18. Ký lại link ảnh mỗi lần danh sách báo cáo đổi** — `features/traffic/components/TrafficReportPanel.tsx:165`
  Chỉ ký ảnh mới (cache theo `imagePath`), không phụ thuộc identity của mảng `incidents`.
- [ ] **19. Gọi 2 RPC lịch sử mỗi lần đổi tuyến** — `app/App.tsx:633` + `RecentPlacesProvider.tsx:68`
  Bỏ qua RPC khi điểm đã đứng đầu danh sách; không ghi lại khi chỉ đổi phương án/tính lại tuyến.
- [ ] **20. Tính lại vị trí các điểm dừng mỗi lần có GPS** — `features/navigation/domain/NavigationGuidanceEngine.ts:120`
  Tính `progress` của từng điểm dừng một lần trong constructor.
- [ ] **21. Chờ cứng 1,2 giây trước khi tải đăng nhập** — `features/auth/context/AuthProvider.tsx:50`
- [ ] **22. Vẫn kiểm tra phiên bản mỗi phút sau khi đã có bản mới / khi tab ẩn** — `app/hooks/useAppUpdate.ts:33`

## C. Dọn code

- [ ] **23. Phép chiếu điểm lên tuyến viết 3 lần** — `features/traffic/services/routeTraffic.ts:36` vs `shared/geo/path.ts` vs `navigation/domain/RoutePath.ts`. Gộp về một chỗ.
- [ ] **24. Haversine/khoảng cách viết lại nhiều nơi** — `navigation/domain/position/SpeedEstimator.ts:17`, `traffic/hooks/useRouteTrafficAlert.ts:37`. Dùng `Geodesy.distanceMeters`.
- [ ] **25. `bearingDegrees` hai bản khác công thức** — `navigation/hooks/useNavigationSession.ts:50` và `navigation/domain/position/SimulatedGpsSource.ts:30`. Đưa vào `Geodesy`.
- [ ] **26. Hằng số đặt tên sai giá trị thật** — `traffic/hooks/useRouteTrafficAlert.ts:204` (`CLOSE_AFTER_DECISION_MS * 2`).
- [ ] **27. Comment `isSamePlace` nói có so khoảng cách ~400 m nhưng code không so** — `places/components/PlaceCombobox.tsx:10`.
- [ ] **28. `App.tsx` gần 1.500 dòng** — `app/App.tsx:207`. Tách phần dẫn đường + cảnh báo + reroute ra hook riêng (vd. `useNavigationController`); nhiều lỗi mục 5, 6, 10, 11 đến từ logic dựng tuyến bị chép nhiều nơi trong file này.

## Kiểm tra sau khi sửa

```bash
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
```
