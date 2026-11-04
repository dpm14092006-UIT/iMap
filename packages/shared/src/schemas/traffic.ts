import { z } from 'zod';
export const incidentTypes = ['traffic_jam','accident','construction','flood','road_closure','obstacle'] as const;
const trafficPhotoPathSchema = z.string().regex(
  /^[0-9a-f-]{36}\/traffic-reports\/[0-9a-f-]{36}\.(jpg|png|webp)$/i,
  'Đường dẫn ảnh báo cáo không hợp lệ',
);
export const trafficReportInputSchema = z.object({
  incidentType: z.enum(incidentTypes),
  severity: z.enum(['low','medium','high']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  note: z.string().max(300).optional(),
  gpsAccuracyM: z.number().min(0).max(100_000).optional(),
  headingDeg: z.number().min(0).lt(360).optional(),
  imagePath: trafficPhotoPathSchema.optional(),
});
export const clearanceSchema = z.object({ state: z.enum(['clear','still_active']) });
export const trafficReportIdSchema = z.string().uuid();
export const trafficBoundsSchema = z.object({
  minLat: z.coerce.number().min(-90).max(90),
  minLng: z.coerce.number().min(-180).max(180),
  maxLat: z.coerce.number().min(-90).max(90),
  maxLng: z.coerce.number().min(-180).max(180),
}).refine((bounds) => bounds.minLat < bounds.maxLat && bounds.minLng < bounds.maxLng, {
  message: 'Phạm vi bản đồ không hợp lệ',
});
export const trafficReportDtoSchema = z.object({
  id: z.string().uuid(),
  incidentType: z.enum(incidentTypes),
  severity: z.enum(['low','medium','high']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  note: z.string().max(300).optional(),
  gpsAccuracyM: z.number().nonnegative().optional(),
  headingDeg: z.number().min(0).lt(360).optional(),
  imagePath: trafficPhotoPathSchema.optional(),
  status: z.enum(['active','cleared','expired']),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  version: z.number().int().positive().optional(),
});
export type TrafficReportInput = z.infer<typeof trafficReportInputSchema>;
export type TrafficReportBounds = z.infer<typeof trafficBoundsSchema>;
export type TrafficReportDto = z.infer<typeof trafficReportDtoSchema>;
