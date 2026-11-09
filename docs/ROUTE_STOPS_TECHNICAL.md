# Tìm điểm dừng dọc tuyến — thiết kế và hướng dẫn kỹ thuật

Ngày triển khai: 09/11/2026. Nhánh tích hợp: `dpm`. Giao diện cuối nằm trong **Trợ lý địa điểm**, chế độ **Dọc tuyến đang đi**. Xem thêm `PLACE_ASSISTANT_TECHNICAL.md` cho chế độ quanh vị trí và voice.

Từ bản phân quyền thành viên, cả `/search` và `/explore` yêu cầu Authorization Bearer token hợp lệ. Xem FEATURE_ACCESS.md.

## Phạm vi sản phẩm

Người dùng tính tuyến A → B, nhập yêu cầu bằng chữ tiếng Việt hoặc tiếng Anh, xem các điểm ghé đủ điều kiện rồi chọn “Ghé điểm này”. Voice điền bản nháp qua nhận dạng trình duyệt hoặc Whisper API; người dùng kiểm tra rồi chủ động bấm Tìm. Xem PLACE_ASSISTANT_TECHNICAL.md và DEPLOY_API.md cho endpoint audio.

Ví dụ: “Tìm trạm xăng, đi thêm tối đa 1 km” hoặc “Find a gas station along my route, with at most 1 km extra”.

Bản đầu: một điểm ghé trên tuyến hai đầu mút; xe máy/ô tô; 14 nhóm địa điểm theo mapping OSM trong `OverpassStopPlaceProvider`. Có thể bỏ điểm ghé và tính lại. Bản này chưa có nút lưu riêng cho tuyến thêm điểm ghé trong Trợ lý. Khi đổi phương tiện hoặc hai đầu mút, tính lại tuyến rồi tìm điểm ghé tương ứng. Đổi đầu mút xóa điểm ghé cũ. Chưa hỗ trợ tìm thêm một điểm vào hành trình đã có điểm ghé; bỏ điểm cũ trước khi tìm lại.

## Phân chia trách nhiệm

| Thành phần | Trách nhiệm | Không làm |
| --- | --- | --- |
| AI `AiStopIntentParser` | Trích xuất loại địa điểm, giới hạn quãng đường/thời gian đi thêm, yêu cầu không xác minh được | Không sinh địa điểm, GPS, đường đi hoặc số liệu đường vòng |
| `KeywordStopIntentParser` | Phương án dự phòng minh bạch cho câu có từ khóa và đơn vị hỗ trợ | Không gắn nhãn đây là kết quả AI |
| `OverpassStopPlaceProvider` | Lấy node/way/relation OSM theo amenity; giữ link nguồn, địa chỉ, giờ mở cửa nếu có | Không tự bịa rating, giá hoặc trạng thái đang mở |
| `VietmapRouteProvider` | Tính tuyến A → B và A → POI → B theo cùng phương tiện/mục tiêu thời gian | Không dùng khoảng cách đường chim bay làm chi phí đường vòng |
| `FindRouteStopsUseCase` | Lọc ứng viên, đo chênh lệch, áp giới hạn và xếp hạng | Không cam kết tối ưu trên toàn bộ địa điểm |
| React `PlaceAssistantPanel` + callbacks trong `App` | Form, kết quả, chọn/bỏ điểm ghé và cập nhật geometry/tổng tuyến | Không tự ghi dữ liệu lên Supabase |

AI là bước hiểu ngôn ngữ. Việc xếp hạng và các câu có số liệu là tính toán xác định, không phải mô hình được huấn luyện. Nhãn `AI hiểu yêu cầu` chỉ xuất hiện sau khi thực sự nhận và kiểm tra được output của model.

## Luồng backend

1. Kiểm tra request: đúng 2 tọa độ, phương tiện hợp lệ, câu nhập 2–300 ký tự, giới hạn đi thêm 0–10 km và 0–60 phút.
2. AI hoặc rules trích xuất intent. Loại địa điểm mơ hồ/trùng nhiều loại trả 422 để người dùng chọn bằng bộ lọc.
3. Bộ lọc chọn tay ưu tiên hơn intent. Nếu không có giới hạn: 2.000 m và 900 giây đi thêm.
4. Server tính lại tuyến gốc A → B qua VietMap. Không nhận geometry hoặc tổng quãng đường do client tự khai để tính đường vòng.
5. Chỉ chấp nhận tuyến đô thị tối đa 80 km, tối đa 30.000 tọa độ, phạm vi bbox tối đa 0,7 độ mỗi chiều.
6. Tạo bbox nới 1.500 m quanh hình học tuyến; truy vấn Overpass theo tag loại địa điểm cố định với `nwr`, `out center tags 120` và timeout.
7. Tính khoảng cách điểm → từng đoạn thẳng của polyline bằng phép chiếu equirectangular cục bộ. Chỉ dùng để loại POI cách tuyến hơn 1.500 m và chọn tối đa 4 ứng viên. Way/relation dùng tâm bbox OSM, chưa xác minh lối vào.
8. Mỗi ứng viên được VietMap tính lại tuyến A → POI → B. Chạy tối đa 2 phép tính đồng thời.
9. Tính chênh lệch, lọc theo giới hạn chưa làm tròn; xếp theo thời gian đi thêm tăng dần, rồi quãng đường đi thêm tăng dần. Trả tối đa 3 kết quả.
10. Người dùng chọn kết quả: dùng chính geometry đã tính cho tuyến ghé; không gọi AI hoặc VietMap thêm ở thao tác chọn.

Công thức:

```text
extraDistanceMeters = max(0, viaRoute.distanceMeters - baseline.distanceMeters)
extraDurationSeconds = max(0, viaRoute.durationSeconds - baseline.durationSeconds)
accept = extraDistanceMeters <= distanceLimit
      && extraDurationSeconds <= timeLimit
```

Hai tuyến cùng tối ưu theo `duration`. Vì nhà cung cấp có thể trả đường khác nhau khi thêm waypoint, chênh lệch âm được hiển thị là không đi thêm; đây là chi phí tăng ròng so với tuyến tham chiếu, không phải quãng đường rẽ nhánh vật lý. ETA không bao gồm thời gian đổ xăng/ăn uống và không cam kết giao thông thời gian thực.

Tối đa 1 lần route gốc + 4 lần route qua điểm, 1 lần Overpass, 1 lần AI mỗi tìm kiếm khi AI bật. Nguồn OSM cache 2 phút, tối đa 30 mục và khử request đồng thời trùng nhau. Kết quả UI quá 2 phút không được thêm vào tuyến trước khi tìm lại.

## API

`POST /api/route-stops/search`

```json
{
  "points": [
    {"lat": 10.772, "lng": 106.698},
    {"lat": 10.794, "lng": 106.721}
  ],
  "vehicle": "motorcycle",
  "query": "Tìm trạm xăng, đi thêm tối đa 1 km"
}
```

Các trường tùy chọn: `category`, `maxExtraDistanceMeters`, `maxExtraDurationSeconds`.

Response theo envelope `{ "data": ... }`:

- `interpretation`: source `ai|rules`, category và giới hạn thực sự áp dụng.
- `candidates[]`: địa điểm có link OSM; `insertAfterIndex=0`; quãng đường/thời gian đi thêm; lý do; `route` chứa toàn bộ geometry và chỉ dẫn VietMap.
- `checkedCandidates`: số POI đã thử tính route, không phải toàn bộ POI trong khu vực.
- `warnings`: giới hạn khảo sát, dữ liệu thiếu, yêu cầu AI/rules không xác minh được và lỗi một phần.
- `searchedAt`: thời điểm hoàn thành kết quả theo server.

Mã lỗi đáng chú ý:

| HTTP | Code | Ý nghĩa |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | Sai tọa độ, số điểm, loại xe hoặc giới hạn |
| 422 | STOP_CATEGORY_UNCLEAR | Chưa xác định một loại điểm dừng |
| 422 | STOP_ROUTE_LIMIT / STOP_SEARCH_AREA_LIMIT | Tuyến quá dài hoặc khu vực quá rộng |
| 503 | VIETMAP_NOT_CONFIGURED | Thiếu key VietMap |
| 502 | STOP_PLACES_UNAVAILABLE | Overpass lỗi, timeout hoặc dữ liệu không đầy đủ |
| 502 | STOP_ROUTES_UNAVAILABLE | Không tính được route qua bất kỳ ứng viên nào |
| 429 | STOP_SEARCH_BUSY | Giới hạn request demo: 5 lần/phút/tài khoản hoặc 2 tìm kiếm đồng thời |

Lỗi key, quota và rate limit VietMap được giữ nguyên thay vì trả kết quả rỗng. Nếu chỉ một vài điểm tính route lỗi thì vẫn trả kết quả thành công còn lại cùng cảnh báo.

## Cấu hình và chi phí

`apps/api/.env` (không commit secret):

```dotenv
VIETMAP_API_KEY=...
STOP_AI_PROVIDER=off
OVERPASS_API_URL=https://overpass-api.de/api/interpreter
```

`off` vẫn cho phép tìm điểm bằng từ khóa, nhưng UI ghi “Bộ lọc từ khóa”.

Để chạy model trên máy:

```dotenv
STOP_AI_PROVIDER=ollama
STOP_AI_MODEL=...
OLLAMA_BASE_URL=http://localhost:11434
```

`STOP_AI_MODEL` phải là model đã có trong `ollama list`. Không tự cài hoặc tải model lớn trong tác vụ triển khai này. Ollama timeout 15 giây; output JSON schema được kiểm tra bằng Zod trước khi dùng.

Để dùng Gemini:

```dotenv
STOP_AI_PROVIDER=gemini
STOP_AI_MODEL=...
GEMINI_API_KEY=...
```

Chọn tên model có quota phù hợp trên chính tài khoản. Dùng `ai@7` + `@ai-sdk/google@4`, `generateText` + `Output.object`, timeout 10 giây, không retry AI và không tự chuyển nhà cung cấp trả phí. Nếu tài khoản/key đã bật billing thì nhà cung cấp vẫn có thể tính phí theo tài khoản; code không thể biến một model trả phí thành miễn phí. Muốn tránh phí API AI thì dùng Ollama local hoặc giữ provider off. Phí/hạn mức VietMap độc lập.

Vercel không gọi được Ollama ở localhost laptop. Muốn chạy cloud cần API AI phù hợp hoặc inference endpoint có thể truy cập và xác thực. Rate limit và cache hiện nằm trong một process, chưa phải cơ chế chia sẻ cho nhiều instance. Không coi cấu hình demo là bảo vệ quota production hoàn chỉnh.

Máy chủ Overpass công khai là tài nguyên dùng chung, có thể chậm/chặn request. Có thể đổi `OVERPASS_API_URL` từ cấu hình server, không nhận URL từ client. Chưa có retry qua hàng loạt instance. Chạy production đông người cần nguồn POI/instance phù hợp.

## Quyền riêng tư và tính đúng đắn

Chỉ gửi câu nhập tới AI; không gửi geometry, API key VietMap hay GPS từ các trường route vào prompt. Câu nhập có thể chứa thông tin người dùng tự gõ, nên cần lựa chọn nhà cung cấp phù hợp. Không ghi log câu nhập hoặc secret trong adapter. Tọa độ tuyến/bbox vẫn được gửi đến các dịch vụ định tuyến/POI để xử lý tìm kiếm.

Tất cả số liệu và reasons do server tính. AI không được tự gọi tool, sinh Overpass QL hay chọn endpoint. Category là enum, tọa độ do server lấy từ route. React hiển thị chuỗi bình thường, không render HTML từ nhà cung cấp.

OSM có thể thiếu trạm xăng hoặc lưu vị trí chưa chính xác; không suy ra đang mở từ `opening_hours`, không suy ra lối vào đi được chỉ vì gần tuyến. Chưa lọc giá, tiện ích, wifi, yên tĩnh hay tính phù hợp cho người khuyết tật. Những yêu cầu này hiển thị là chưa xác minh. Kết quả không thay thế việc kiểm tra địa điểm thực tế.

## Kiểm thử và giới hạn xác minh

Bộ kiểm thử tuyến gốc đã đạt trước khi mở rộng. Kết quả cuối của bản tích hợp và các ca mới được ghi trong `PLACE_ASSISTANT_TECHNICAL.md`.

- Unit tests cho phép chiếu điểm vào polyline, đoạn trùng, đơn vị và thứ tự `[lng,lat]`.
- Parser tests tiếng Việt/Anh: dấu phẩy thập phân, km/miles/phút, số bằng chữ tiếng Anh, câu mơ hồ/phủ định, không nhầm thời gian ngồi tại quán với thời gian đi thêm.
- Use-case tests với provider fixtures: POI gần tuyến nhưng đường vòng dài bị loại; lọc trước khi làm tròn; giới hạn 0; giới hạn bốn ứng viên; xếp hạng; lỗi một phần; lỗi quota; tuyến quá dài.
- Adapter tests: OSM node/center/nguồn/private, cache/in-flight dedup, Overpass timeout remark, Ollama JSON, fallback khi output lỗi/hết quota, không gọi model khi chưa bật.
- HTTP integration tests: API envelope + geometry, request không hợp lệ, rate limit/Retry-After.
- Browser trên một server fixture tách biệt: tính tuyến → gõ/tìm điểm → xem delta → chọn điểm → bỏ điểm trở lại tuyến gốc. Fixture có nhãn “KIỂM THỬ — dữ liệu mô phỏng”; không được dùng để khẳng định route thật hay chất lượng model.

Lúc triển khai, máy thiếu `VIETMAP_API_KEY` và cấu hình model; chưa kiểm tra đường vòng bằng VietMap thật hoặc chất lượng hiểu ngôn ngữ bằng model thật. Kiểm tra live Overpass mặc định trả HTTP 406, instance thay thế bị timeout trong lần thử. Các trường hợp này được ứng dụng trả lỗi rõ; không thay bằng dữ liệu mẫu trong bản chạy thật.

## Nguồn kỹ thuật

- VietMap Route v4: https://maps.vietmap.vn/docs/map-api/route-version/route-v4/
- Overpass QL: https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
- Public instances: https://wiki.openstreetmap.org/wiki/Overpass_API
- AI SDK version-matched docs: `node_modules/ai/docs/03-ai-sdk-core/10-generating-structured-data.mdx`
- Google provider version-matched docs: `node_modules/@ai-sdk/google/docs/15-google.mdx`
- Ollama structured outputs: https://docs.ollama.com/capabilities/structured-outputs
- Gemini pricing/terms: https://ai.google.dev/gemini-api/docs/pricing ; https://ai.google.dev/gemini-api/terms
