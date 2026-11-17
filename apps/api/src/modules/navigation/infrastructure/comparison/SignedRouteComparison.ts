import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  routeComparisonFactSchema,
  type RouteComparisonFact,
  type RouteComparisonSnapshot,
  type RouteResult,
} from '@routetwin/shared';
import { z } from 'zod';
import { AppError } from '../../../../shared/errors/AppError.js';

const snapshotTtlMs = 10 * 60_000;
const payloadSchema = z.object({
  expiresAt: z.number().int(),
  routes: z.tuple([routeComparisonFactSchema], routeComparisonFactSchema),
});

export class SignedRouteComparison {
  constructor(private readonly key: string) {}

  sign(result: RouteResult, sessionId: string, aiAvailable: boolean): RouteComparisonSnapshot | undefined {
    const routes = [result, ...(result.alternatives ?? [])].map((route, index) => ({
      id: String.fromCharCode(65 + index),
      durationSeconds: route.durationSeconds,
      distanceMeters: route.distanceMeters,
      turnCount: route.turnCount ?? null,
    }));
    const expiresAt = Date.now() + snapshotTtlMs;
    if (!payloadSchema.safeParse({ expiresAt, routes }).success) return undefined;

    const payload = Buffer.from(JSON.stringify({ expiresAt, routes })).toString('base64url');
    return {
      token: payload + '.' + this.mac(payload, sessionId).toString('base64url'),
      expiresAt,
      aiAvailable,
      routes,
    };
  }

  verify(token: string, sessionId: string): [RouteComparisonFact, ...RouteComparisonFact[]] {
    const [payload, signature, ...rest] = token.split('.');
    if (!payload || !signature || rest.length) throw this.invalid();
    const provided = Buffer.from(signature, 'base64url');
    const expected = this.mac(payload, sessionId);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) throw this.invalid();

    const snapshot = payloadSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
    if (snapshot.expiresAt <= Date.now()) throw this.invalid();
    return snapshot.routes;
  }

  private mac(payload: string, sessionId: string): Buffer {
    return createHmac('sha256', this.key).update(`imap-route-comparison:v1:${sessionId}:${payload}`).digest();
  }

  private invalid() {
    return new AppError(410, 'ROUTE_COMPARISON_EXPIRED', 'Phiên so sánh đã hết hạn. Hãy tính lại tuyến.');
  }
}
