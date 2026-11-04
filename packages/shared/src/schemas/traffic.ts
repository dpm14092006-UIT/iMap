import { z } from 'zod';
export const incidentTypes = ['traffic_jam','accident','construction','flood','road_closure','obstacle'] as const;
export const trafficReportInputSchema = z.object({
  incidentType: z.enum(incidentTypes),
  severity: z.enum(['low','medium','high']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  note: z.string().max(300).optional(),
});
export const clearanceSchema = z.object({ state: z.enum(['clear','still_active']) });
export type TrafficReportInput = z.infer<typeof trafficReportInputSchema>;
export type TrafficReportDto = TrafficReportInput & {id:string;createdAt:string;status:'active'|'cleared'};
