# Trợ lý địa điểm — bản tích hợp dpm

Ngày 09/11/2026. Dùng tab **Trợ lý địa điểm**. Gõ nhu cầu tiếng Anh/Việt; không cần biết tên POI. Đây là tìm loại địa điểm trong dữ liệu OSM, chưa phải tìm mọi thực thể bằng ngôn ngữ tự nhiên.

Trợ lý yêu cầu tài khoản đã đăng nhập. API xác minh Bearer token với Supabase; khách vẫn dùng tìm địa chỉ và chỉ đường. Xem [phân quyền](../architecture/FEATURE_ACCESS.md).

## Luồng và trách nhiệm

```text
Chữ / chọn loại → bản nháp → người dùng bấm Tìm
→ POST /api/route-stops/explore
→ AiStopIntentParser hoặc KeywordStopIntentParser
→ intent được Zod kiểm tra
→ chưa rõ: clarify → người dùng chọn loại
→ quanh vị trí: Overpass → haversine → POI
→ dọc tuyến: Overpass → VietMap A-B và A-POI-B → lọc đi thêm → POI
```

14 nhóm: trạm xăng, cà phê, nhà hàng, nhà thuốc, ATM, nhà vệ sinh, trường học, bệnh viện, bãi đỗ xe, công viên, thư viện, trạm xe buýt, ga tàu, trạm nghỉ. OSM dùng tag cố định và loại điểm private/no. Không tạo POI, đánh giá, giá hoặc giờ mở cửa bằng AI.

AI chỉ đọc câu nhập và tối đa 4 câu ngữ cảnh, không nhận GPS/geometry. `STOP_AI_PROVIDER=off` mặc định dùng rules và ghi nhãn rõ. Gemini/Ollama là adapter tùy chọn, output schema giống nhau. Câu mới rõ loại ưu tiên hơn ngữ cảnh cũ. “Find the station” chưa có ngữ cảnh trả câu hỏi trạm xăng / trạm bus / ga tàu. “I need a break” hỏi cà phê / công viên / trạm nghỉ. Người dùng xóa ngữ cảnh được.

Quanh vị trí: chọn điểm trên map hoặc dùng tâm bản đồ, bán kính mặc định 2 km, tối đa 5 km; trả tối đa 8 POI. Khoảng cách ghi rõ đường thẳng, chưa có ETA. Tìm quanh vị trí không cần key VietMap; bấm chỉ đường thì cần.

Dọc tuyến: chỉ nhận tuyến hai đầu mút, xe máy/ô tô. Giới hạn mặc định thêm 2 km, 15 phút; tối đa 10 km, 60 phút. Server tự tính đường gốc, khảo sát tối đa 4 POI trong hành lang 1,5 km, tính tuyến qua từng điểm và trả tối đa 3. Thêm điểm dùng geometry thật của tuyến qua POI, bỏ điểm sẽ tính lại A-B. Khi route/vị trí/chế độ đổi, hủy request và loại kết quả cũ. Kết quả quá 2 phút phải tìm lại trước khi dùng. Xem [chi tiết thuật toán](ROUTE_STOPS_TECHNICAL.md).

## Hợp đồng HTTP

`POST /api/route-stops/explore`:

```json
{"query":"Find a school within two kilometers","context":[],"mode":"nearby","center":{"lat":10.7769,"lng":106.7009},"vehicle":"motorcycle"}
```

Response envelope `{ "data": ... }`, discriminated union theo `status`: `clarify`, `needs_location`, `needs_route`, `results`. `results` phân tiếp `mode=nearby|route`. Có `source=ai|rules`, cảnh báo và thời điểm khảo sát. Bộ lọc loại/bán kính/km/phút chọn tay ưu tiên câu chữ. Validation lỗi 400; provider lỗi 502; giới hạn tải 429, không giả kết quả rỗng khi upstream hỏng.

`POST /api/route-stops/search` giữ endpoint chuyên tìm điểm ghé. Cùng giới hạn 5 lần/phút/tài khoản qua bộ đếm nguyên tử trong Postgres và tối đa 2 request xử lý mỗi process qua limiter trong RAM. Cache Overpass 2 phút/30 mục, dedupe request trùng.

## Âm thanh dẫn đường

Từ 19/11/2026 đã bỏ thu âm, Web Speech Recognition và Whisper API. Trợ lý chỉ nhận chữ hoặc loại địa điểm chọn tay; `/api/voice/*` không còn được đăng ký.

Khi bắt đầu dẫn đường, `useNavigationAudio` phát chỉ dẫn bằng `SpeechSynthesis` theo ngôn ngữ giao diện. Mỗi bước nhắc lúc chuẩn bị, còn 200 m và còn 40 m; không lặp lại cùng mốc do GPS dao động. Cảnh báo được ưu tiên hơn chỉ dẫn. Nút loa trên banner bật/tắt cả lời đọc và chuông, lưu lựa chọn trên thiết bị; rung và banner vẫn hoạt động khi tắt tiếng. Dừng chuyến đi hủy lời đọc. Giọng đọc phụ thuộc trình duyệt và giọng đã cài trên thiết bị, không xin quyền micro hoặc gọi API nhận giọng nói.

Các benchmark nhận dạng giọng nói cũ chỉ giữ để tham khảo lịch sử.

## Xác minh và giới hạn

Typecheck và build toàn repo; bộ test HTTP/provider/intent/geometry/âm thanh. Các phiên kiểm thử trình duyệt trước đây dùng POI/tuyến mô phỏng để kiểm tra mơ hồ → chọn loại, đổi nhu cầu fuel → school, ghé tuyến tăng tổng và bỏ điểm trở về tuyến gốc. Kiểm thử SpeechRecognition thuộc phiên bản đã gỡ, chỉ còn giá trị lịch sử. Fixture không chứng minh chất lượng dữ liệu thật hoặc âm thanh trên thiết bị.

Whisper local được chạy thật trên 48 audio TTS, xem báo cáo riêng. Chưa có Gemini/VietMap key nên chưa xác minh các dịch vụ đó end-to-end. Overpass public từng trả HTTP406/timeout trong môi trường kiểm tra; có xử lý lỗi minh bạch và `OVERPASS_API_URL` thay được. Không cam kết POI đầy đủ, đang mở cửa, lối vào hoặc giao thông realtime. Không có migration mới cho tính năng này.
