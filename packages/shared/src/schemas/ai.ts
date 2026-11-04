import { z } from 'zod';

export const trafficImageAnalysisSchema = z.object({
  status: z.enum(['visible_incident', 'no_obvious_incident', 'unclear']),
  incidentType: z.enum(['traffic_jam', 'accident', 'construction', 'flood', 'road_closure', 'obstacle']).nullable(),
  severity: z.enum(['low', 'medium', 'high']).nullable(),
  description: z.string().max(500),
  confidence: z.number().min(0).max(1),
  evidence: z.string().max(500),
}).superRefine((result, context) => {
  if (result.status === 'visible_incident' && result.incidentType === null) {
    context.addIssue({ code: 'custom', path: ['incidentType'], message: 'A visible incident needs a supported incident type.' });
  }
  if (result.status !== 'visible_incident' && (result.incidentType !== null || result.severity !== null)) {
    context.addIssue({ code: 'custom', path: ['incidentType'], message: 'Unclear or absent incidents must not claim a type or severity.' });
  }
});

export const trafficSignRecognitionSchema = z.object({
  recognized: z.boolean(),
  text: z.string().max(160).nullable(),
  category: z.enum(['prohibition', 'warning', 'mandatory', 'guide', 'other', 'unknown']),
  confidence: z.number().min(0).max(1),
  description: z.string().max(500),
}).superRefine((result, context) => {
  if (!result.recognized && result.text !== null) {
    context.addIssue({ code: 'custom', path: ['text'], message: 'Unrecognized signs must not return text.' });
  }
});

export const aiTaskSchema = z.enum(['traffic_analysis', 'sign_recognition']);
export const aiAnalysisDtoSchema = z.object({
  id: z.string().uuid().optional(),
  task: aiTaskSchema,
  result: z.record(z.string(), z.unknown()),
  model: z.string(),
  imagePath: z.string().optional(),
  processedAt: z.string().datetime(),
});

export type AiTask = z.infer<typeof aiTaskSchema>;
export type TrafficImageAnalysis = z.infer<typeof trafficImageAnalysisSchema>;
export type TrafficSignRecognition = z.infer<typeof trafficSignRecognitionSchema>;
export type AiAnalysisDto = z.infer<typeof aiAnalysisDtoSchema>;
