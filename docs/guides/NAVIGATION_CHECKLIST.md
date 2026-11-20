# Kiểm tra dẫn đường

1. Chạy `./run.sh`, mở ứng dụng, chọn điểm đi/đến và tính tuyến. Kiểm tra phương tiện, điểm ghé, thứ tự và tuỳ chọn tuyến.
2. Bấm Bắt đầu trên thiết bị có GPS và cấp quyền vị trí. Trước thao tác này, ứng dụng không được tự theo dõi GPS.
3. Kiểm tra mũi tên, hướng, chỉ dẫn, tiến độ và âm thanh theo thiết lập người dùng. Không có vị trí thì báo đang tìm GPS; bị từ chối quyền thì có thông báo và thao tác thử lại.
4. Khi di chuyển, bản đồ bám vị trí; kéo bản đồ để xem trước rồi bấm định tâm để bám lại. Cảnh báo lấy từ báo cáo cộng đồng; không tạo sự cố giả trong ứng dụng.
5. Kết thúc hoặc đến nơi phải dừng watch GPS. Mở chuyến mới không được nhận kết quả vị trí từ chuyến cũ.

`npm run test:browser` tự chạy Chromium với fixture API/tile và vị trí được công cụ kiểm thử cấp cho native Geolocation API. Script còn xác minh URL/storage Demo cũ không bật lại bất kỳ điều khiển mô phỏng nào. Đây là test lặp lại được, không thay thế thử GPS và âm thanh trên thiết bị thực tế.

API thuật toán và benchmark vẫn có thể chạy độc lập bằng các lệnh benchmark trong package.json. Chúng không bật chế độ thuyết trình trong giao diện.
