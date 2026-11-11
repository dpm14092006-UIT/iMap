import type { OptimizeRouteRequest } from '@routetwin/shared';

export interface MatrixProvider {
  /** Ma trận chi phí có hướng (giây hoặc mét theo `objective`); matrix[i][j] có thể khác matrix[j][i]. */
  getCosts(input: OptimizeRouteRequest): Promise<number[][]>;
}
