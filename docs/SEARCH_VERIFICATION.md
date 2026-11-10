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
