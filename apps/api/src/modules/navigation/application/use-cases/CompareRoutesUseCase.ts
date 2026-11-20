import { createHash } from 'node:crypto';
import type {
  CompareRoutesRequest,
  RouteComparisonResult,
  RouteComparisonSnapshot,
  RoutePreference,
  RouteResult,
} from '@routetwin/shared';
import { AppError } from '../../../../shared/errors/AppError.js';
import { ConcurrencyLimiter } from '../../../../shared/http/ConcurrencyLimiter.js';
import type { FeatureQuota } from '../../../../shared/quota/FeatureQuota.js';
import { rankRouteComparison, readRoutePreference } from '../../domain/routeComparison.js';
import type { RouteComparisonSnapshots } from '../ports/RouteComparisonSnapshots.js';
import type { RoutePreferenceProvider } from '../ports/RoutePreferenceProvider.js';

/** Thành viên đã xác thực; null khi khách hoặc không xác thực được. */
export type ComparisonMember = { userId: string; accessToken: string };

type PreferenceDecision = { preference: RoutePreference; source: 'ai' | 'rules' };

const MAX_CACHED_PREFERENCES = 128;

/**
 * So sánh các phương án tuyến đã ký theo mong muốn của người dùng.
 * Mong muốn dạng chữ được AI hiểu (khi có provider, đã đăng nhập và còn hạn mức); mọi lỗi đều
 * quay về bộ quy tắc cục bộ trên cùng ảnh chụp, nên người dùng luôn nhận được kết quả.
 */
export class CompareRoutesUseCase {
  private readonly limiter = new ConcurrencyLimiter(2);
  private readonly aiPreferences = new Map<string, RoutePreference>();

  constructor(
    private readonly snapshots: RouteComparisonSnapshots | undefined,
    private readonly preferences: RoutePreferenceProvider | undefined,
    private readonly quota: FeatureQuota,
  ) {}

  /** Ký ảnh chụp cho kết quả tính tuyến; undefined khi chưa cấu hình khóa ký. */
  snapshot(result: RouteResult, sessionId: string): RouteComparisonSnapshot | undefined {
    return this.snapshots?.sign(result, sessionId, Boolean(this.preferences));
  }

  /** AI chỉ được thử khi có provider và yêu cầu có thể xác thực được. */
  canUseAi(): boolean {
    return Boolean(this.preferences);
  }

  /**
   * @param authenticate Xác thực người gọi khi (và chỉ khi) cần dùng AI; trả null nếu không xác thực được.
   */
  async execute(
    request: CompareRoutesRequest,
    authenticate: (() => Promise<ComparisonMember | null>) | null,
  ): Promise<RouteComparisonResult> {
    if (!this.snapshots) {
      throw new AppError(503, 'ROUTE_COMPARISON_UNAVAILABLE', 'So sánh tuyến chưa sẵn sàng.');
    }
    const routes = this.snapshots.verify(request.snapshot, request.sessionId);
    if (request.preference.kind === 'preset') {
      return rankRouteComparison(routes, { goal: request.preference.goal, maxExtraMinutes: null }, 'rules');
    }
    const decision = await this.interpret(request.preference.text, request.snapshot, authenticate);
    return rankRouteComparison(routes, decision.preference, decision.source);
  }

  private async interpret(
    text: string,
    snapshot: string,
    authenticate: (() => Promise<ComparisonMember | null>) | null,
  ): Promise<PreferenceDecision> {
    const fallback: PreferenceDecision = { preference: readRoutePreference(text), source: 'rules' };
    const provider = this.preferences;
    if (!provider || !authenticate) return fallback;

    try {
      const result = await this.limiter.run(async (): Promise<PreferenceDecision> => {
        const member = await authenticate();
        if (!member) return fallback;
        // Provider và prompt cố định; ảnh chụp đã ký giới hạn việc dùng lại trong mười phút.
        const cacheKey = createHash('sha256')
          .update(JSON.stringify([member.userId, snapshot, text]))
          .digest('hex');
        const cached = this.aiPreferences.get(cacheKey);
        if (cached) return { preference: cached, source: 'ai' };

        await this.quota.consume('route_explanation', member.accessToken);
        const preference = await provider.interpret(text);
        this.remember(cacheKey, preference);
        return { preference, source: 'ai' };
      });
      return result?.value ?? fallback;
    } catch {
      return fallback;
    }
  }

  private remember(key: string, preference: RoutePreference): void {
    if (this.aiPreferences.size >= MAX_CACHED_PREFERENCES) {
      this.aiPreferences.delete(this.aiPreferences.keys().next().value!);
    }
    this.aiPreferences.set(key, preference);
  }
}
