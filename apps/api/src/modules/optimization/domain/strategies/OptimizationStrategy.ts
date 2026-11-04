export interface OptimizationStrategy {
  /** Danh sách index điểm ghé; index 0 là xuất phát được cố định. */
  optimize(matrix: number[][]): number[];
}
