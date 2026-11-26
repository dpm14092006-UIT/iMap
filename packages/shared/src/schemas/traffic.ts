import { z } from 'zod';
import { isInVietmapCoverage, MAX_TRAFFIC_BOUNDS_SPAN_DEG } from '../constants.js';
import { noteTextSchema, outsideCoverageMessage, publicMessage, strictNumber } from './input.js';
export const incidentTypes = [
  'traffic_jam',
  'accident',
  'construction',
  'flood',
  'road_closure',
  'obstacle',
] as const;
export const trafficVehicleScopeSchema = z.enum(['car', 'motorcycle', 'both']);
export const trafficImageAnalysisTaskSchema = z.enum(['incident', 'traffic_sign']);
export const imageAnalysisConfidenceSchema = z.enum(['low', 'medium', 'high']);
export const trafficIncidentImageAnalysisSchema = z.object({
  task: z.literal('incident'),
  trafficRelated: z.boolean(),
  incidentType: z.enum([...incidentTypes, 'unknown']),
  summary: z.string().trim().min(1).max(220),
  evidence: z.array(z.string().trim().min(1).max(120)).max(4),
  confidence: imageAnalysisConfidenceSchema,
  canDetermineSpeed: z.literal(false),
});
export const trafficSignImageAnalysisSchema = z.object({
  task: z.literal('traffic_sign'),
  trafficSign: z.boolean(),
  category: z.enum(['prohibition', 'warning', 'mandatory', 'information', 'supplementary', 'unknown']),
  label: z.string().trim().min(1).max(120),
  visibleText: z.string().trim().max(120),
  confidence: imageAnalysisConfidenceSchema,
  changesRouteRules: z.literal(false),
});
export const trafficImageAnalysisDtoSchema = z.discriminatedUnion('task', [
  trafficIncidentImageAnalysisSchema,
  trafficSignImageAnalysisSchema,
]);
const trafficPhotoPathSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/traffic-reports\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i,
    'Đường dẫn ảnh báo cáo không hợp lệ',
  );
export const trafficReportInputSchema = z
  .object({
    incidentType: z.enum(incidentTypes),
    severity: z.enum(['low', 'medium', 'high']),
    vehicleScope: trafficVehicleScopeSchema.default('both'),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    note: noteTextSchema(300).optional(),
    gpsAccuracyM: z.number().min(0).max(100_000).optional(),
    headingDeg: z.number().min(0).lt(360).optional(),
    imagePath: trafficPhotoPathSchema.optional(),
  })
  .refine(isInVietmapCoverage, { ...publicMessage(outsideCoverageMessage), path: ['lat'] });
export const clearanceSchema = z.object({ state: z.enum(['clear', 'still_active']) });
export const trafficReportIdSchema = z.string().uuid();
export const trafficBoundsSchema = z
  .object({
    minLat: strictNumber(z.number().min(-90).max(90)),
    minLng: strictNumber(z.number().min(-180).max(180)),
    maxLat: strictNumber(z.number().min(-90).max(90)),
    maxLng: strictNumber(z.number().min(-180).max(180)),
  })
  .refine(
    (bounds) => bounds.minLat < bounds.maxLat && bounds.minLng < bounds.maxLng,
    publicMessage('Phạm vi bản đồ không hợp lệ.'),
  )
  .refine(
    (bounds) =>
      bounds.maxLat - bounds.minLat <= MAX_TRAFFIC_BOUNDS_SPAN_DEG &&
      bounds.maxLng - bounds.minLng <= MAX_TRAFFIC_BOUNDS_SPAN_DEG,
    publicMessage(
      `Vùng bản đồ quá rộng; hãy phóng to (tối đa ${MAX_TRAFFIC_BOUNDS_SPAN_DEG}° mỗi chiều) để xem báo cáo giao thông.`,
    ),
  );
export const trafficReportDtoSchema = z.object({
  id: z.string().uuid(),
  incidentType: z.enum(incidentTypes),
  severity: z.enum(['low', 'medium', 'high']),
  vehicleScope: trafficVehicleScopeSchema,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  note: z.string().max(300).optional(),
  gpsAccuracyM: z.number().nonnegative().optional(),
  headingDeg: z.number().min(0).lt(360).optional(),
  imagePath: trafficPhotoPathSchema.optional(),
  status: z.enum(['active', 'cleared', 'expired']),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  version: z.number().int().positive().optional(),
  communityReportCount: z.number().int().nonnegative().optional(),
  communityReporterCount: z.number().int().nonnegative().optional(),
  communityUpdatedAt: z.string().datetime().nullable().optional(),
});
export type TrafficReportInput = z.infer<typeof trafficReportInputSchema>;
export type TrafficReportBounds = z.infer<typeof trafficBoundsSchema>;
export type TrafficReportDto = z.infer<typeof trafficReportDtoSchema>;
export type TrafficVehicleScope = z.infer<typeof trafficVehicleScopeSchema>;
export type TrafficImageAnalysisTask = z.infer<typeof trafficImageAnalysisTaskSchema>;
export type TrafficImageAnalysisDto = z.infer<typeof trafficImageAnalysisDtoSchema>;
