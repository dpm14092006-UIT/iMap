/**
 * Kết quả sắp xếp thứ tự ghé.
 * - order: danh sách index điểm theo thứ tự đi; index 0 (điểm xuất phát) luôn đứng đầu,
 *   và lặp lại ở cuối nếu là hành trình khép kín (quay về điểm xuất phát).
 * - cost: tổng chi phí theo ma trận (giây hoặc mét).
 */
export type TourResult = { order: number[]; cost: number };

/** Tên các nhóm thuật toán, dùng cho API và UI. */
export type TourAlgorithm = 'exact' | 'heuristic';

/**
 * Interface chung cho mọi thuật toán sắp xếp điểm ghé (Strategy pattern).
 * Ma trận có hướng: matrix[i][j] có thể khác matrix[j][i] (đường một chiều).
 * Infinity nghĩa là không có đường đi giữa hai điểm.
 */
export interface OptimizationStrategy {
  readonly name: string;
  optimize(matrix: number[][], returnToStart?: boolean): TourResult;
}
