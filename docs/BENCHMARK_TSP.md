# Benchmark sắp xếp điểm ghé (TSP đường đi mở)

- 200 bộ dữ liệu mỗi dòng; ma trận có hướng giả lập trong trung tâm TP.HCM (đường chim bay × hệ số đường vòng 1,2–1,8 theo từng chiều).
- Điểm xuất phát cố định, điểm cuối tự do (giống chế độ mặc định của app). "Dài hơn tối ưu" so với lời giải chính xác của Held–Karp.
- Máy chạy: darwin arm64, Node v26.8.2. Ngày chạy: 2026-11-11.

| Điểm ghé | NN dài hơn tối ưu (TB) | NN + 2-opt dài hơn tối ưu (TB) | 2-opt tệ nhất | 2-opt ra đúng tối ưu | ms Held–Karp | ms 2-opt |
|---|---|---|---|---|---|---|
| 3 | 2.5% | 0.0% | 3.3% | 100% | 0.01 | 0.003 |
| 4 | 4.2% | 0.9% | 24.1% | 88% | 0.00 | 0.002 |
| 5 | 6.7% | 1.1% | 24.2% | 85% | 0.01 | 0.003 |
| 6 | 6.6% | 1.1% | 17.0% | 78% | 0.02 | 0.005 |
| 7 | 7.4% | 1.7% | 28.1% | 76% | 0.03 | 0.006 |
| 8 | 9.1% | 2.0% | 23.0% | 64% | 0.07 | 0.007 |
| 9 | 10.8% | 2.2% | 24.6% | 63% | 0.17 | 0.010 |
| 10 | 12.2% | 2.4% | 22.8% | 59% | 0.38 | 0.012 |
| 11 | 11.4% | 2.6% | 21.5% | 52% | 0.85 | 0.016 |
| 12 | 11.5% | 2.7% | 17.5% | 45% | 1.90 | 0.021 |
| 13 | 11.6% | 2.8% | 22.4% | 41% | 3.91 | 0.040 |
| 14 | 12.8% | 2.9% | 22.6% | 42% | 8.78 | 0.063 |
| 15 | 13.7% | 3.5% | 24.5% | 36% | 19.91 | 0.076 |

**Đọc kết quả:**
- Held–Karp luôn cho lời giải tối ưu; thời gian tăng theo O(n²·2ⁿ) — gần gấp đôi mỗi khi thêm 1 điểm, nhưng vẫn chỉ vài chục ms ở 15 điểm ghé.
  Vì vậy app dùng Held–Karp cho chế độ "Tự động" trong toàn bộ giới hạn 15 điểm ghé.
- Nearest Neighbor (tham lam) dài hơn tối ưu vài phần trăm và tệ dần khi nhiều điểm; thêm 2-opt kéo sai lệch trung bình xuống còn khoảng 1–3%,
  nhưng không đảm bảo tối ưu (cột "2-opt tệ nhất"). 2-opt nhanh hơn Held–Karp nhiều lần và tăng chậm (đa thức), nên phù hợp khi số điểm vượt giới hạn của Held–Karp.
