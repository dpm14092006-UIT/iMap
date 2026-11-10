# Kiểm tra tìm kiếm VietMap và bản đồ toàn quốc

Ngày 11/11/2026. Chạy qua API local dùng key VietMap thật, không fixture cho các truy vấn bên dưới. Đây là kiểm tra mẫu, không phải cam kết độ phủ mọi địa điểm.

| Truy vấn | HTTP | Số gợi ý | Tọa độ kết quả chọn |
|---|---:|---:|---|
| THPT Trường Chinh | 200 | 1 | Có |
| THPT Truong Chinh | 200 | 1 | Có |
| Đại học Bách Khoa | 200 | 10 | Có |
| Benh vien Cho Ray | 200 | 10 | Có |
| Bệnh viện Từ Dũ | 200 | 10 | Có |
| 197 Trần Phú | 200 | 10 | Có |
| 227 Nguyen Van Cu | 200 | 10 | Có |
| Nguyễn Huệ | 200 | 10 | Có |
| AEON Tân Phú | 200 | 7 | Có |
| Highlands Coffee | 200 | 10 | Có |
| sân bay Tân Sơn Nhất | 200 | 8 | Có |
| zzqxxvnonexistent987654 | 200 | 0 | Không chọn (rỗng) |
| Hồ Hoàn Kiếm Hà Nội | 200 | 5 | Có |
| Lăng Chủ tịch Hồ Chí Minh | 200 | 6 | Có |
| Cầu Rồng Đà Nẵng | 200 | 4 | Có |
| sân bay Đà Nẵng | 200 | 9 | Có |
| Bến Ninh Kiều Cần Thơ | 200 | 2 | Có |
| sân bay Cần Thơ | 200 | 10 | Có |

## Tính tuyến từ tọa độ đã chọn

| Điểm đi | Điểm đến | HTTP | Quãng đường |
|---|---|---:|---:|
| THPT Trường Chinh | AEON Tân Phú | 200 | 5.69 km |
| Benh vien Cho Ray | 197 Trần Phú | 200 | 2.09 km |
| 227 Nguyen Van Cu | sân bay Tân Sơn Nhất | 200 | 8.15 km |
| Hồ Hoàn Kiếm Hà Nội | Lăng Chủ tịch Hồ Chí Minh | 200 | 3.15 km |
| Bến Ninh Kiều Cần Thơ | sân bay Cần Thơ | 200 | 11.12 km |
| Cầu Rồng (sau sửa xếp hạng) | Sân bay Đà Nẵng | 200 | 4.30 km |

## Phát hiện và giới hạn

- Tên không dấu THPT Truong Chinh và Benh vien Cho Ray đều có kết quả và tọa độ.
- Chuỗi vô nghĩa trả danh sách rỗng, không giả địa điểm.
- Truy vấn Cầu Rồng ban đầu bị doanh nghiệp Hạt Giống Cầu Rồng đứng trước. Đã thêm ưu tiên tên POI khớp trực tiếp; chạy lại cây cầu đứng đầu và tuyến đến sân bay trả 200.
- Đại học Bách Khoa có nhiều cơ sở; tên chung có thể trả cơ sở Dĩ An. Giao diện hiển thị địa chỉ để chọn đúng, nên nhập thêm đường/cơ sở nếu cần.
- Giá trị tọa độ lấy từ Place v4; chưa khảo sát thực địa lối vào từng POI.
- Bản đồ và VietMap phục vụ toàn quốc. Graph Dijkstra/A* riêng chỉ có dữ liệu trung tâm TP.HCM.

## Nguồn tích hợp

- https://maps.vietmap.vn/docs/map-api/autocomplete-version/autocomplete-v4/
- https://maps.vietmap.vn/docs/assets/agents/search-geocoding.txt

## Kiểm tra bổ sung tên đường

Đã thử thêm 18 truy vấn đường/số nhà: Nguyễn Văn Cừ Quận 5, 3 Tháng 2, Nguyễn Thị Minh Khai, Điện Biên Phủ, Đường Láng, Nguyễn Trãi Hà Nội, 12 Tràng Thi, 30/4 Cần Thơ, Trần Phú Nha Trang, Lê Lợi Huế, Nguyễn Văn Cừ Quy Nhơn, 2 Tháng 9, Quốc lộ 1A, DT743 và DCT9. Có gợi ý không đồng nghĩa kết quả đầu chắc chắn là tên đường: tên đường trùng tên phường/cửa hàng cần kiểm tra dòng địa chỉ hoặc chọn bộ lọc **Tên đường**.

DCT9 sau chuẩn hóa và lọc STREET trả **Đường DCT 9, Tân Hưng Thuận, Quận 12**. Địa chỉ **9G7 DCT9** chưa có số nhà phù hợp trong dữ liệu; không tự lấy số 17 hoặc cửa hàng khác làm kết quả. Gợi ý thêm thao tác tìm đường bỏ số nhà. Autocomplete rỗng hoặc không có số nhà khớp sẽ thử Search v4 đúng câu nhập một lần, không giả tọa độ.

## Kiểm tra tối ưu và lưu trạng thái bảng

- Ma trận có hướng cho 4 điểm thực: thứ tự nhập 0-1-2-3 có chi phí 22.952,79 m; thứ tự tối ưu 0-3-2-1 có chi phí 13.541,34 m. Route API trả tuyến dài 13.541,3 m và 309 điểm hình học.
- Ưu tiên thời gian: 2.771 s xuống 1.635 s theo ma trận. Hành trình quay về điểm xuất phát cũng trả tuyến hợp lệ.
- Trên trình duyệt: Chợ Bến Thành → Thảo Cầm Viên → Dinh Độc Lập nhập theo thứ tự trên. Nhiều điểm tự đổi thành Bến Thành → Dinh Độc Lập → Thảo Cầm Viên, 3,9 km / 8 phút. Đóng bảng và mở lại còn đủ điểm, cấu hình và kết quả.
- Chỉ đường với điểm ghé thủ công giữ Bến Thành → Thảo Cầm Viên → Dinh Độc Lập, trả 5,1 km / 10 phút, không tự đổi thứ tự.
