import { z } from 'zod';
export const geoPointSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
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
