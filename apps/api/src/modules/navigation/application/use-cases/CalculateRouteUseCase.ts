import type { RoutePathResult, RouteRequest, RouteResult, RouteVariant } from '@routetwin/shared';
import { areNearDuplicateRoutes } from '../../domain/algorithms/routeSimilarity.js';
import type { RouteProvider } from '../../domain/ports/RouteProvider.js';

type AvoidOption = NonNullable<RouteRequest['avoid']>[number];

/** Các biến thể tính thêm khi cần nhiều phương án: VietMap thường chỉ trả 1 tuyến cho ô tô. */
const FAN_OUT: { avoid: AvoidOption; variant: RouteVariant }[] = [
  { avoid: 'toll', variant: 'avoid-toll' },
  { avoid: 'motorway', variant: 'avoid-motorway' },
  { avoid: 'ferry', variant: 'avoid-ferry' },
];

export const MAX_ROUTE_OPTIONS = 4;

export class CalculateRouteUseCase {
  constructor(private readonly provider: RouteProvider) {}

  async execute(request: RouteRequest): Promise<RouteResult> {
    if (!request.alternatives) return this.provider.calculate(request);

    const userAvoid = request.avoid ?? [];
    const extras = FAN_OUT.filter(({ avoid }) => !userAvoid.includes(avoid));

    // Lời gọi chính lỗi thì báo lỗi như cũ; lời gọi phụ lỗi thì bỏ qua.
    const [base, ...settled] = await Promise.allSettled([
      this.provider.calculate(request),
      ...extras.map(({ avoid }) =>
        this.provider.calculate({ ...request, avoid: [...userAvoid, avoid] }),
      ),
    ]);
    if (base!.status === 'rejected') throw base!.reason;

    const candidates: RoutePathResult[] = flatten(base!.value, 'default');
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') candidates.push(...flatten(result.value, extras[index]!.variant));
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
