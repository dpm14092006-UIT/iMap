import { z } from 'zod';

export const routePreferenceGoalSchema = z.enum(['fastest', 'shortest', 'fewest-turns']);
export type RoutePreferenceGoal = z.infer<typeof routePreferenceGoalSchema>;

export const routePreferenceSchema = z.object({
  goal: routePreferenceGoalSchema.nullable(),
  maxExtraMinutes: z.number().min(0).max(180).nullable(),
});
export type RoutePreference = z.infer<typeof routePreferenceSchema>;

export const comparisonSessionSchema = z.uuid();
export const compareRoutesRequestSchema = z.object({
  snapshot: z.string().min(1).max(8192),
  sessionId: comparisonSessionSchema,
  preference: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('preset'), goal: routePreferenceGoalSchema }),
    z.object({ kind: z.literal('text'), text: z.string().trim().min(1).max(240) }),
  ]),
});
export type CompareRoutesRequest = z.infer<typeof compareRoutesRequestSchema>;

export const routeComparisonFactSchema = z.object({
  id: z.string(),
  durationSeconds: z.number().int().positive(),
  distanceMeters: z.number().positive(),
  turnCount: z.number().int().nonnegative().nullable(),
});
export type RouteComparisonFact = z.infer<typeof routeComparisonFactSchema>;

export type RouteComparisonSnapshot = {
  token: string;
  expiresAt: number;
  aiAvailable: boolean;
  routes: RouteComparisonFact[];
};

export type RouteComparisonResult = {
  source: 'rules' | 'ai';
  preference: RoutePreference;
  status: 'recommended' | 'equivalent' | 'single-route' | 'no-match' | 'unknown-turns' | 'clarify';
  recommendedId: string | null;
  baselineId: string;
  evidence: {
    id: 'duration' | 'distance' | 'turns';
    delta: number;
  }[];
};
