# N1 – OSM road graph pipeline

1. Chọn vùng thử nghiệm nhỏ ở TP.HCM. OSM `.pbf` phải có nguồn/attribution hợp lệ.
2. Parse intersection/ways/oneway/access; dựng directed graph; giữ geometry riêng.
3. Tạo `road_segments` với length meters, allowedVehicles, speed metadata.
4. Test đường một chiều, rẽ cấm (turn restrictions cần mô hình chuyển tiếp phù hợp, không chỉ lọc cạnh).
5. Snap tọa độ đầu/cuối vào road segment hợp lệ. Không map-match tùy tiện ở cầu vượt.
6. Benchmark và audit độ chính xác trước khi dùng để hướng dẫn lái xe.
