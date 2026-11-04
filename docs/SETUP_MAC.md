# Setup macOS (Apple Silicon)

1. Kiểm tra `node -v` (>= 20.19), `npm -v`.
2. `cd RouteTwin_OOP_Starter && ./run.sh`
3. Mở `http://localhost:5173`.
4. Kiểm tra backend `curl http://localhost:4000/api/health`.
5. Khi tích hợp provider thật, copy `.env.example` trong từng app thành `.env` và điền key.

Lỗi thường gặp: port 4000 hoặc 5173 đã sử dụng → tắt tiến trình cũ / đổi `API_PORT` và proxy tương ứng. `npm install` cần mạng lần đầu. Không copy trực tiếp secret ra frontend.
