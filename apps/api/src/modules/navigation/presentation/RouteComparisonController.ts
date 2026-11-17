import { createHash } from 'node:crypto';
import { compareRoutesRequestSchema, type RoutePreference, type RouteResult } from '@routetwin/shared';
import type { Request, RequestHandler, Response } from 'express';
import { AppError } from '../../../shared/errors/AppError.js';
import type { AuthenticatedRequest } from '../../../shared/http/authenticated-request.js';
import { ConcurrencyLimiter } from '../../../shared/http/ConcurrencyLimiter.js';
import { requireAuth } from '../../../shared/http/require-auth.js';
import { getBearerToken } from '../../../shared/http/request-context.js';
import { SupabaseUserFeatureQuota } from '../../../shared/supabase/SupabaseUserFeatureQuota.js';
import type { RoutePreferenceProvider } from '../application/ports/RoutePreferenceProvider.js';
import { rankRouteComparison, readRoutePreference } from '../domain/routeComparison.js';
import type { SignedRouteComparison } from '../infrastructure/comparison/SignedRouteComparison.js';

export class RouteComparisonController {
  private readonly limiter = new ConcurrencyLimiter(2);
  private readonly aiPreferences = new Map<string, RoutePreference>();

  constructor(
    private readonly snapshots?: SignedRouteComparison,
    private readonly provider?: RoutePreferenceProvider,
    private readonly quota = new SupabaseUserFeatureQuota(),
    private readonly authenticate = requireAuth(),
  ) {}

  snapshot(result: RouteResult, sessionId: string) {
    return this.snapshots?.sign(result, sessionId, Boolean(this.provider));
  }

  compare: RequestHandler = async (req, res, next) => {
    try {
      const request = compareRoutesRequestSchema.parse(req.body);
      if (!this.snapshots)
        throw new AppError(503, 'ROUTE_COMPARISON_UNAVAILABLE', 'So sánh tuyến chưa sẵn sàng.');
      const routes = this.snapshots.verify(request.snapshot, request.sessionId);
      if (request.preference.kind === 'preset') {
        const preference = { goal: request.preference.goal, maxExtraMinutes: null };
        res.json({ data: rankRouteComparison(routes, preference, 'rules') });
        return;
      }

      const { text } = request.preference;
      const decision = await this.interpret(text, request.snapshot, req, res);
      res.json({ data: rankRouteComparison(routes, decision.preference, decision.source) });
    } catch (error) {
      next(error);
    }
  };

  private async interpret(text: string, snapshot: string, req: Request, res: Response) {
    const fallback = { preference: readRoutePreference(text), source: 'rules' as const };
    const provider = this.provider;
    if (!provider || !getBearerToken(req)) return fallback;

    // If auth, quota, or the provider cannot complete, the same snapshot still supports a local comparison.
    try {
      const result = await this.limiter.run(async () => {
        await new Promise<void>((resolve, reject) => {
          void this.authenticate(req, res, (error) => (error ? reject(error) : resolve()));
        });
        const auth = (req as AuthenticatedRequest).auth;
        if (!auth) return fallback;
        // Provider and prompt are fixed for this controller. The signed snapshot limits reuse to ten minutes.
        const cacheKey = createHash('sha256')
          .update(JSON.stringify([auth.userId, snapshot, text]))
          .digest('hex');
        const cached = this.aiPreferences.get(cacheKey);
        if (cached) return { preference: cached, source: 'ai' as const };

        await this.quota.consume('route_explanation', auth.accessToken);
        const preference = await provider.interpret(text);
        if (this.aiPreferences.size >= 128)
          this.aiPreferences.delete(this.aiPreferences.keys().next().value!);
        this.aiPreferences.set(cacheKey, preference);
        return { preference, source: 'ai' as const };
      });
      return result?.value ?? fallback;
    } catch {
      return fallback;
    }
  }
}
