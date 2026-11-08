# Nghiên cứu AI so sánh và giải thích tuyến đường cho iMap

Ngày: 09/11/2026. Phạm vi: nghiên cứu thiết kế, chưa triển khai hoặc kiểm thử model thật.

## Đề xuất

Xây dựng trợ lý giải thích lựa chọn tuyến bằng tiếng Việt, gắn ngay trong panel chỉ đường. Người dùng xem các tuyến hợp lệ, chọn ưu tiên hoặc nhập mong muốn; hệ thống so sánh số liệu và đưa ra nhận xét có căn cứ. Người dùng quyết định tuyến cuối cùng.

Ví dụ nhu cầu: “Tôi chưa quen đường, đi thêm tối đa 5 phút cũng được nếu ít rẽ hơn.” AI chuyển câu này thành ràng buộc có cấu trúc; backend lọc tuyến theo ràng buộc; trợ lý giải thích vì sao một tuyến phù hợp và phải đánh đổi gì.

AI xử lý ngôn ngữ và giải thích. VietMap cung cấp các tuyến. Backend tính toán và kiểm tra dữ kiện. Không mô tả bộ xếp hạng theo trọng số cố định là mô hình đã học.

## Hiện trạng đã kiểm tra trong code local

- `VietmapRouteProvider.calculate` đọc `paths`, sắp xếp rồi chỉ trả phần tử đầu tiên. Các tuyến khác không đến được frontend.
- `alternative` hiện phụ thuộc vào `objective === 'distance'`; tính năng so sánh cần yêu cầu tuyến thay thế độc lập với mục tiêu này.
- `RouteResult`, `RouteApiClient`, `useDirections` và bản đồ hiện phục vụ một tuyến đang chọn.
- Khoảng cách, thời gian, hình học, chỉ dẫn và tên đường đã có trong kiểu dữ liệu.
- Provider lọc bỏ instruction khi cả `text` và `street_name` rỗng. Không nên đếm số lần rẽ từ danh sách này trước khi kiểm tra mất dữ liệu; cần giữ instruction gốc và ánh xạ mã maneuver.
- Chưa kiểm thử trực tiếp VietMap với API key. Số tuyến thực tế và dữ liệu tùy chọn cần xác nhận trên tài khoản thật.

## Nguồn dữ liệu và mức độ có thể khẳng định

VietMap Route v4 có `alternative=true` để yêu cầu các phương án trong `paths`; có khoảng cách, thời gian, hình học và chỉ dẫn. Tài liệu còn mô tả annotations giao thông và phí đường bộ tùy dữ liệu trả về. Các trường này chưa được provider hiện tại chuyển ra frontend. Không giả định luôn có đủ hai hoặc ba tuyến.

Nguồn: https://maps.vietmap.vn/docs/map-api/route-version/route-v4/

| Tiêu chí | Cách lấy | Cách diễn đạt |
| --- | --- | --- |
| Khoảng cách | Số liệu của mỗi tuyến | “Ngắn hơn trong các tuyến đang so sánh” |
| Thời gian | ETA của cùng một lần truy vấn | “Thời gian dự kiến”; không hứa thời gian đến thực tế |
| Số lần rẽ | Tính từ loại maneuver đã ánh xạ, loại trừ xuất phát/kết thúc/đi thẳng | “Ít lần rẽ hơn”; không suy ra đường rộng hoặc an toàn hơn |
| Đường chính đi qua | Tên đường trong chỉ dẫn, bỏ trùng | Chỉ nêu tên có trong dữ liệu |
| Báo cáo cộng đồng gần tuyến | Truy vấn hành lang tuyến theo thời gian/trạng thái, giữ nguồn báo cáo | “Có báo cáo gần tuyến”; chưa map-match thì không kết luận sự cố nằm trên đúng chiều đường |
| Giao thông và phí | Chỉ dùng khi API thực sự trả dữ liệu phù hợp | Thiếu là chưa có dữ liệu; không thay bằng 0 |
| Độ an toàn, đèn đỏ, đường đẹp, ít bụi, độ rộng đường | Chưa có nguồn tin cậy trong hệ thống | Không đưa vào khuyến nghị bản đầu |

## Luồng đề xuất

1. Người dùng chọn điểm đi, điểm đến và phương tiện.
2. Backend lấy tuyến thay thế, chuẩn hóa đơn vị mét/giây và gắn ID cho từng tuyến trong một snapshot có thời điểm truy vấn.
3. Bỏ phương án trùng; nếu chỉ có một tuyến thì giải thích tuyến đó, không tạo tuyến giả.
4. Backend tính đặc trưng, chênh lệch và các mệnh đề có ID bằng chứng.
5. Người dùng chọn “ưu tiên thời gian”, “ưu tiên quãng đường”, “ít rẽ hơn”, hoặc nhập câu tự do.
6. AI trích xuất sở thích thành schema được kiểm tra: mục tiêu, mức tăng thời gian tối đa, điều chưa rõ cần hỏi lại.
7. Backend áp dụng điều kiện cứng rồi xếp hạng theo quy tắc minh bạch. Nếu không có tuyến đáp ứng thì thông báo đúng kết quả và đưa ra lựa chọn nới điều kiện.
8. AI chọn các lý do liên quan và tạo diễn giải ngắn; UI hiển thị bảng số liệu, nguồn và lý do đánh đổi.
9. Người dùng chọn tuyến; AI không tự thay tuyến đang dẫn.

Mọi so sánh phải dùng các tuyến cùng snapshot, phương tiện và điểm đi/đến. Khi dữ liệu đổi, hủy giải thích cũ. “Nhanh nhất” chỉ có nghĩa trong các phương án được trả về, không phải tối ưu toàn bộ mạng đường.

## Ví dụ minh họa — dữ liệu giả lập để mô tả UX

| Tuyến | Quãng đường | Thời gian dự kiến | Số lần rẽ |
| --- | --- | --- | --- |
| A | 8,2 km | 24 phút | 12 |
| B | 9,1 km | 27 phút | 6 |

Với ưu tiên “thêm tối đa 5 phút để ít rẽ hơn”, B đáp ứng giới hạn: lâu hơn 3 phút, thêm 0,9 km, ít hơn 6 lần rẽ so với A. AI giải thích đánh đổi theo sở thích đã nhập. Không mô tả B là an toàn hơn, ít kẹt hơn hoặc tiết kiệm xăng hơn.

Nếu A và B bằng nhau theo các tiêu chí có dữ liệu, hiển thị “Hai tuyến tương đương theo các tiêu chí hiện có”, không ép tạo ra lợi ích.

## Kiểm soát kết quả AI

- Không gửi toàn bộ GPS trace, địa chỉ nhà hoặc geometry cho model nếu chỉ cần bảng đặc trưng. Dùng ID tuyến và số liệu tối thiểu.
- AI trả `routeId`, `reasonIds`, `tradeoffIds`, `limitations`, `clarifyingQuestion`; backend đối chiếu ID với snapshot tin cậy.
- Giai đoạn đầu, số liệu và câu so sánh định lượng được render từ facts đã tính. Không tin số do model tự tính hoặc sửa.
- Nếu cho phép văn bản tự do, cần đo và kiểm tra phát biểu không có nguồn; JSON đúng schema không đảm bảo nội dung đúng.
- Coi tên đường/ghi chú báo cáo là dữ liệu, không phải chỉ dẫn cho model.
- Đánh dấu giải thích đến từ model hay fallback. AI lỗi/hết quota thì bảng so sánh và chọn tuyến vẫn hoạt động; fallback dùng mẫu câu và không gắn nhãn “AI”.

## Kiến trúc phù hợp Clean Architecture hiện tại

- Mở rộng port định tuyến trả tập phương án, giữ khả năng chọn một tuyến cho luồng cũ.
- `BuildRouteFactsUseCase`: chuẩn hóa số liệu, tính chênh lệch và evidence IDs.
- `InterpretRoutePreferenceUseCase`: trích xuất nhu cầu từ tiếng Việt, kiểm tra schema.
- `RankRouteCandidatesUseCase`: áp dụng ràng buộc và tiêu chí xếp hạng đã công bố.
- `ExplainRouteComparisonUseCase`: kết hợp facts và sở thích để sinh giải thích có kiểm tra.
- Port `RouteExplanationProvider`: thay được nhà cung cấp local/cloud, không khóa nghiệp vụ vào một model.
- Endpoint đề xuất `/api/routes/compare`: server lấy và lưu snapshot tạm; không tin metrics do client tự gửi.
- Endpoint giải thích dùng `comparisonId` còn hạn, thuộc đúng phiên người dùng; cache theo snapshot, sở thích, phiên bản prompt và model.
- UI: thẻ tuyến A/B, bảng chênh lệch, ô sở thích và khối “Vì sao phù hợp?”.

## Phương án miễn phí

**Demo local:** mô hình văn bản chạy qua Ollama. Không cần vision hoặc GPU thuê theo giờ; khả năng chạy và độ trễ phải đo trên máy thực tế. Ollama local hỗ trợ output theo JSON schema.

Nguồn: https://docs.ollama.com/capabilities/structured-outputs

**Web trên Vercel:** có thể dùng model có free tier qua backend trong hạn mức tài khoản, với rate limit/cache và fallback. Cần xác minh model được cấp quota trong AI Studio, không chốt model bằng tên đoán hoặc cam kết số lượt cố định. Gemini free tier có điều khoản dữ liệu và giới hạn ứng dụng có khả năng được người dưới 18 tuổi truy cập; cần xem xét trước khi dùng cho bản đồ công khai.

Nguồn: https://ai.google.dev/gemini-api/docs/pricing
Nguồn: https://ai.google.dev/gemini-api/docs/rate-limits
Nguồn: https://ai.google.dev/gemini-api/terms

Server trên Vercel không thể gọi Ollama ở `localhost` của laptop. Chạy local cần backend local hoặc một inference endpoint có thể truy cập và xác thực; chưa triển khai endpoint đó trong nghiên cứu này.

Miễn phí phần AI không đồng nghĩa VietMap không tính phí. Cần kiểm tra key, gói dịch vụ và hạn mức tài khoản VietMap riêng.

## Phạm vi triển khai và đánh giá

Đợt 1: lấy phương án thay thế, so sánh khoảng cách/thời gian/số lần rẽ đã xác định; AI hiểu ưu tiên và giải thích. Bắt đầu với hai điểm và phương tiện hiện có. Chưa thêm báo cáo giao thông vào điểm xếp hạng.

Đợt 2: gắn sự cố cộng đồng, nguồn và thời điểm; xử lý map-matching/chiều đường trước khi tuyên bố tuyến đi qua sự cố.

Đợt 3: giải thích cá nhân hóa từ phản hồi người dùng, chỉ khi có đủ dữ liệu và sự đồng ý phù hợp.

Bộ kiểm thử đề xuất: 30–50 tình huống tuyến có đáp án tính được, khoảng 100 cách diễn đạt sở thích tiếng Việt. Đây là quy mô khởi đầu để kiểm tra, không phải benchmark đủ lớn để khẳng định khả năng tổng quát.

Đo riêng:
- Trích xuất đúng mục tiêu/ràng buộc; hỏi lại đúng khi mơ hồ.
- Số liệu hiển thị và chênh lệch khớp facts; mục tiêu thiết kế là không để model quyết định số liệu.
- Tuân thủ giới hạn thời gian tăng thêm.
- Tỷ lệ phát biểu không có căn cứ, đặc biệt “an toàn”, “không kẹt”, “không có phí”.
- Tỷ lệ người dùng hiểu đúng đánh đổi và thời gian chọn tuyến, so sánh với bảng dữ liệu và mẫu câu không AI.
- Độ trễ p50/p95, cache hit, tỷ lệ timeout/quota, khả năng dùng app khi AI lỗi.

Các ca quan trọng: một tuyến duy nhất; hai tuyến giống nhau; thiếu maneuver; bằng nhau; ETA bằng 0/không hợp lệ; không có tuyến đáp ứng; dữ liệu báo cáo cũ; chuyển phương tiện khi AI còn trả lời; lỗi AI; prompt injection trong ghi chú.

Tên đề tài gợi ý: “Ứng dụng mô hình ngôn ngữ hỗ trợ so sánh và giải thích lựa chọn tuyến đường theo sở thích người dùng”.
