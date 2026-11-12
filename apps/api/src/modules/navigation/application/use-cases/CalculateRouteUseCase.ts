import type { RoutePathResult, RouteRequest, RouteResult, RouteVariant } from '@routetwin/shared';
import { areNearDuplicateRoutes } from '../../domain/algorithms/routeSimilarity.js';
import type { RouteProvider } from '../../domain/ports/RouteProvider.js';

type AvoidOption = NonNullable<RouteRequest['avoid']>[number];

/**
 * Các biến thể tính thêm khi cần nhiều phương án: VietMap thường chỉ trả 1 tuyến cho ô tô.
 * `avoid-toll` chỉ được giữ khi mọi tuyến trả về có toll_cost = 0; `motorway` không kiểm chứng được
 * từ dữ liệu trả về nên luôn là `alternative`.
 */
const FAN_OUT: { avoid: AvoidOption; variant: RouteVariant }[] = [
  { avoid: 'toll', variant: 'avoid-toll' },
  { avoid: 'motorway', variant: 'alternative' },
  { avoid: 'ferry', variant: 'avoid-ferry' },
];

export type RouteLogger = { warn(message: string, fields: Record<string, unknown>): void };
const consoleLogger: RouteLogger = {
  warn: (message, fields) => console.warn(JSON.stringify({ message, ...fields })),
};

export const MAX_ROUTE_OPTIONS = 4;

export class CalculateRouteUseCase {
  constructor(
    private readonly provider: RouteProvider,
    private readonly logger: RouteLogger = consoleLogger,
  ) {}

  async execute(request: RouteRequest, context: { requestId?: string } = {}): Promise<RouteResult> {
    if (!request.alternatives) return this.provider.calculate(request);

    const userAvoid = request.avoid ?? [];
    const extras = FAN_OUT.filter(({ avoid }) => !userAvoid.includes(avoid));

    // Lời gọi chính lỗi thì báo lỗi như cũ; lời gọi phụ lỗi thì bỏ qua.
    const [base, ...settled] = await Promise.allSettled([
      this.provider.calculate(request),
      ...extras.map(({ avoid }) => this.provider.calculate({ ...request, avoid: [...userAvoid, avoid] })),
    ]);
    if (base!.status === 'rejected') throw base!.reason;

    const candidates: RoutePathResult[] = flatten(base!.value, 'default');
    settled.forEach((result, index) => {
      const extra = extras[index]!;
      if (result.status === 'rejected') {
        // Chỉ ghi tên/mã lỗi, không ghi URL hay API key.
        const reason: unknown = result.reason;
        this.logger.warn('Lời gọi tuyến phụ thất bại, bỏ qua phương án này', {
          requestId: context.requestId,
          avoid: extra.avoid,
          error: errorLabel(reason),
        });
        return;
      }
      candidates.push(...flatten(result.value, resolveVariant(extra.variant, result.value)));
    });

    const unique: RoutePathResult[] = [];
    for (const path of candidates) {
      if (!unique.some((kept) => areNearDuplicateRoutes(kept, path))) unique.push(path);
    }
    const byObjective = (a: RoutePathResult, b: RoutePathResult) =>
      request.objective === 'distance'
        ? a.distanceMeters - b.distanceMeters
        : a.durationSeconds - b.durationSeconds;
    const [primary, ...alternatives] = unique.sort(byObjective).slice(0, MAX_ROUTE_OPTIONS);
    return { ...primary!, ...(alternatives.length ? { alternatives } : {}) };
  }
}

function flatten(result: RouteResult, variant: RouteVariant): RoutePathResult[] {
  const { alternatives, ...primary } = result;
  return [primary, ...(alternatives ?? [])].map((path) => ({ ...path, variant }));
}

/** `avoid-toll` chỉ đúng khi VietMap báo toll_cost = 0 cho MỌI tuyến của lời gọi đó. */
function resolveVariant(variant: RouteVariant, result: RouteResult): RouteVariant {
  if (variant !== 'avoid-toll') return variant;
  const paths = [result, ...(result.alternatives ?? [])];
  return paths.every((path) => path.tollCostVnd === 0) ? 'avoid-toll' : 'alternative';
}

function errorLabel(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return error instanceof Error ? error.name : 'UnknownError';
}
