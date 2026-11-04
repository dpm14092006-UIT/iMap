export interface MatrixProvider {
  /** Ma trận thời gian/chi phí có hướng; matrix[i][j] có thể khác matrix[j][i]. */
  getDurationMatrix(points: ReadonlyArray<{lat: number; lng: number}>, vehicle: 'car'|'motorcycle'): Promise<number[][]>;
}
