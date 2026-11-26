import type { PlaceSearchProvider } from '../application/ports/PlaceSearchProvider.js';
import { AppError } from '../../../shared/errors/AppError.js';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
  isInVietmapCoverage,
  outsideCoverageMessage,
  publicMessage,
  searchTextSchema,
  strictNumber,
} from '@routetwin/shared';
import type { ReverseGeocodeUseCase } from '../application/use-cases/ReverseGeocodeUseCase.js';
import type { SearchPlacesUseCase } from '../application/use-cases/SearchPlacesUseCase.js';

/** GET /api/places/suggest?q=...&lat=...&lng=... */
const searchQuerySchema = z
  .object({
    q: searchTextSchema(2, 120),
    kind: z.enum(['all', 'street']).default('all'),
    lat: strictNumber(z.number().min(-90).max(90)).optional(),
    lng: strictNumber(z.number().min(-180).max(180)).optional(),
  })
  .refine(
    ({ lat, lng }) => (lat === undefined) === (lng === undefined),
    publicMessage('Cần gửi đủ cả vĩ độ và kinh độ cho vị trí ưu tiên.'),
  );

/** GET /api/places/reverse?lat=...&lng=... */
const reverseQuerySchema = z
  .object({
    lat: strictNumber(z.number().min(-90).max(90)),
    lng: strictNumber(z.number().min(-180).max(180)),
  })
  .refine(isInVietmapCoverage, { ...publicMessage(outsideCoverageMessage), path: ['lat'] });

/** GET /api/places/details?id=...: mã tham chiếu VietMap là chuỗi ASCII in được, không khoảng trắng. */
const placeIdSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .refine((id) => /^[\x21-\x7e]+$/.test(id), publicMessage('Mã địa điểm không hợp lệ.')),
});

/** Controller HTTP: chỉ validate input và trả JSON, logic nằm trong use case. */
export class PlaceSearchController {
  constructor(
    private readonly searchPlaces: SearchPlacesUseCase,
    private readonly reverseGeocode: ReverseGeocodeUseCase,
    private readonly provider?: PlaceSearchProvider,
  ) {}

  suggest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = searchQuerySchema.parse(req.query);
      // Tâm bản đồ ngoài vùng VietMap (vd. đang xem nước láng giềng) chỉ bị bỏ qua, không làm hỏng tìm kiếm.
      const focus =
        input.lat !== undefined &&
        input.lng !== undefined &&
        isInVietmapCoverage({ lat: input.lat, lng: input.lng })
          ? { lat: input.lat, lng: input.lng }
          : undefined;
      res.json({ data: await this.searchPlaces.execute(input.q, focus, input.kind) });
    } catch (error) {
      next(error);
    }
  };

  resolve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = placeIdSchema.parse(req.query);
      if (!this.provider?.resolve)
        throw new AppError(503, 'PLACE_RESOLVE_UNAVAILABLE', 'Dịch vụ lấy tọa độ chưa sẵn sàng.');
      res.json({ data: await this.provider.resolve(id) });
    } catch (error) {
      next(error);
    }
  };

  reverse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const point = reverseQuerySchema.parse(req.query);
      // data = null khi không tìm được địa chỉ; client tự dùng tọa độ làm tên.
      res.json({ data: await this.reverseGeocode.execute(point) });
    } catch (error) {
      next(error);
    }
  };
}
