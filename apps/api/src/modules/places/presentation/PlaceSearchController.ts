import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { SearchPlacesUseCase } from '../application/use-cases/SearchPlacesUseCase.js';

const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  lat: z.coerce.number().finite().optional(),
  lng: z.coerce.number().finite().optional(),
});

export class PlaceSearchController {
  constructor(private readonly searchPlaces: SearchPlacesUseCase) {}

  suggest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = searchQuerySchema.parse(req.query);
      const focus = input.lat !== undefined && input.lng !== undefined ? { lat: input.lat, lng: input.lng } : undefined;
      res.json({ data: await this.searchPlaces.execute(input.q, focus) });
    } catch (error) {
      next(error);
    }
  };
}
