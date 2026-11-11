import { z } from 'zod';
export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export const routeRequestSchema = z.object({
  points: z.array(geoPointSchema).min(2).max(25),
  vehicle: z.enum(['car', 'motorcycle']),
  objective: z.enum(['distance', 'duration']).default('duration'),
});
export type RouteRequest = z.infer<typeof routeRequestSchema>;
export type RouteInstruction = {
  distanceMeters: number;
  durationSeconds: number;
  text: string;
  streetName: string;
  sign?: number;
  heading?: number;
};
export type RouteResult = {
  source: 'vietmap';
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][]; // GeoJSON [lng, lat]
  instructions: RouteInstruction[];
};

/** Fixed departure, up to eight stops; departure is repeated only in the optimized closed tour. */
export const optimizeRouteRequestSchema = z
  .object({
    points: z.array(geoPointSchema).min(2).max(9),
    vehicle: z.enum(['car', 'motorcycle']),
    objective: z.enum(['distance', 'duration']).default('duration'),
    returnToStart: z.boolean().default(false),
  })
  .refine(
    ({ points }) =>
      points.every((point, index) =>
        points
          .slice(0, index)
          .every(
            (other) =>
              Math.abs(point.lat - other.lat) > 0.000001 || Math.abs(point.lng - other.lng) > 0.000001,
          ),
      ),
    { message: 'Các điểm dừng không được trùng vị trí.' },
  );
export type OptimizeRouteRequest = z.infer<typeof optimizeRouteRequestSchema>;
export type OptimizeRouteResult = {
  order: number[];
  route: RouteResult;
  originalCost: number | null;
  optimizedCost: number;
  objective: 'distance' | 'duration';
};
