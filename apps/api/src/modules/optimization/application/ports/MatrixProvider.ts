/** Đầu vào để lấy ma trận chi phí giữa các điểm. */
export type MatrixRequest = {
  points: ReadonlyArray<{ lat: number; lng: number }>;
  vehicle: 'car' | 'motorcycle';
  objective: 'distance' | 'duration';
};

/**
 * Port lấy ma trận chi phí đường bộ có hướng (giây hoặc mét).
 * matrix[i][j] có thể khác matrix[j][i]; Infinity = không có đường đi.
 * Triển khai thật: VietmapMatrixProvider (infrastructure).
 */
export interface MatrixProvider {
  getCosts(input: MatrixRequest): Promise<number[][]>;
}
