import { z } from 'zod';
import type { OptimizeRouteRequest } from '@routetwin/shared';
import { AppError } from '../../../shared/errors/AppError.js';
import type { MatrixProvider } from '../domain/ports/MatrixProvider.js';
const matrixSchema = z.array(z.array(z.union([z.number().finite().nonnegative(), z.literal(-1), z.null()])));
const responseSchema = z.object({
  code: z.string(),
  durations: matrixSchema.optional(),
  distances: matrixSchema.optional(),
});
export class VietmapMatrixProvider implements MatrixProvider {
  constructor(private readonly key?: string) {}
  async getCosts(input: OptimizeRouteRequest): Promise<number[][]> {
    if (!this.key) throw new AppError(503, 'MATRIX_NOT_CONFIGURED', 'Chưa cấu hình VietMap Matrix.');
    const url = new URL('https://maps.vietmap.vn/api/matrix/v4');
    url.search = new URLSearchParams({
      apikey: this.key,
      vehicle: input.vehicle,
      annotation: input.objective,
      sources: 'all',
      destinations: 'all',
    }).toString();
    for (const point of input.points) url.searchParams.append('point', `${point.lat},${point.lng}`);
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    } catch {
      throw new AppError(
        502,
        'MATRIX_UNAVAILABLE',
        'Không lấy được chi phí đường đi từ VietMap. Hãy thử lại.',
      );
    }
    if (response.status === 401 || response.status === 403)
      throw new AppError(502, 'MATRIX_AUTH', 'Key VietMap chưa được cấp quyền Matrix để sắp xếp điểm dừng.');
    if (response.status === 423 || response.status === 429)
      throw new AppError(429, 'MATRIX_QUOTA', 'VietMap Matrix chưa được bật hoặc đã hết hạn mức.');
    if (!response.ok) throw new AppError(502, 'MATRIX_UNAVAILABLE', 'VietMap Matrix chưa sẵn sàng.');
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AppError(502, 'MATRIX_INVALID', 'VietMap trả ma trận không hợp lệ.');
    }
    const data = responseSchema.safeParse(payload);
    if (!data.success) throw new AppError(502, 'MATRIX_INVALID', 'VietMap trả ma trận không hợp lệ.');
    if (data.data.code === 'OVER_DAILY_LIMIT')
      throw new AppError(429, 'MATRIX_QUOTA', 'VietMap Matrix đã hết hạn mức trong ngày.');
    if (data.data.code !== 'OK')
      throw new AppError(502, 'MATRIX_UNAVAILABLE', 'VietMap không tính được ma trận cho các điểm đã chọn.');
    const matrix = input.objective === 'distance' ? data.data.distances : data.data.durations;
    if (
      !matrix ||
      matrix.length !== input.points.length ||
      matrix.some((row) => row.length !== input.points.length)
    )
      throw new AppError(502, 'MATRIX_INVALID', 'Ma trận thiếu chi phí giữa các điểm dừng.');
    return matrix.map((row) => row.map((value) => (value === null || value === -1 ? Infinity : value)));
  }
}
