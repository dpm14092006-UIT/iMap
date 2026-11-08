import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type { ReverseGeocodeUseCase } from '../application/use-cases/ReverseGeocodeUseCase.js';
import type { SearchPlacesUseCase } from '../application/use-cases/SearchPlacesUseCase.js';

/** GET /api/places/suggest?q=...&lat=...&lng=... */
const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

/** GET /api/places/reverse?lat=...&lng=... */
const reverseQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/** Controller HTTP: chỉ validate input và trả JSON, logic nằm trong use case. */
export class PlaceSearchController {
  constructor(
    private readonly searchPlaces: SearchPlacesUseCase,
    private readonly reverseGeocode: ReverseGeocodeUseCase,
  ) {}

  suggest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = searchQuerySchema.parse(req.query);
      const focus = input.lat !== undefined && input.lng !== undefined ? { lat: input.lat, lng: input.lng } : undefined;
      res.json({ data: await this.searchPlaces.execute(input.q, focus) });
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
