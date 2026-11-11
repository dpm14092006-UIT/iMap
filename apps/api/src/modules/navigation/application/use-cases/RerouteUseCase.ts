import {
  rerouteRequestSchema,
  type BlockingIncident,
  type RerouteRequest,
  type RerouteResult,
  type RouteResult,
} from '@routetwin/shared';
import type { AlternativeRouteProvider } from '../../domain/ports/AlternativeRouteProvider.js';
import { detourPoints, nearestSegment, routePassesNear } from '../../domain/reroute/routeGeometry.js';

/** Điểm vòng tránh cách sự cố thêm bao nhiêu mét ngoài bán kính của nó. */
const DETOUR_EXTRA_METERS = 250;

type LatLng = { lat: number; lng: number };

/**
 * Tính lại tuyến từ vị trí hiện tại (Dynamic Rerouting), cố gắng tránh sự cố:
 * 1. Lấy các tuyến ứng viên từ VietMap (tuyến chính + tuyến thay thế).
 * 2. Chọn tuyến tốt nhất KHÔNG đi qua sự cố nào.
 * 3. Nếu tuyến nào cũng bị chặn: thử đi vòng qua 2 điểm hai bên sự cố đầu tiên.
 * 4. Vẫn không được: trả tuyến tốt nhất và báo số sự cố còn trên đường (không giả vờ là đã tránh).
 * Tối đa 3 lần gọi VietMap cho mỗi lần tính lại.
 */
export class RerouteUseCase {
  constructor(private readonly provider: AlternativeRouteProvider) {}

  async execute(raw: RerouteRequest): Promise<RerouteResult> {
    const input = rerouteRequestSchema.parse(raw);
    const points = [input.from, ...input.stops];
    const candidates = await this.provider.calculateAlternatives({
      points,
      vehicle: input.vehicle,
      objective: input.objective,
    });
    const best = candidates[0]!;

    // Không có sự cố cần tránh: dùng luôn tuyến tốt nhất.
    if (input.avoid.length === 0)
      return { route: best, strategy: 'direct', blockedCount: 0, candidatesChecked: candidates.length };

    const clear = candidates.find((route) => this.blockersOn(route, input.avoid).length === 0);
    if (clear) {
      return {
        route: clear,
        strategy: clear === best ? 'direct' : 'alternative',
        blockedCount: 0,
        candidatesChecked: candidates.length,
      };
    }

    // Mọi tuyến đều bị chặn → thử đi vòng quanh sự cố đầu tiên trên tuyến tốt nhất.
    const blocker = this.blockersOn(best, input.avoid)[0]!;
    const detours = await this.detourCandidates(input, best, blocker);
    const checked = candidates.length + detours.length;
    const clearDetour = detours
      .filter((route) => this.blockersOn(route, input.avoid).length === 0)
      .sort((a, b) => this.cost(a, input.objective) - this.cost(b, input.objective))[0];
    if (clearDetour)
      return { route: clearDetour, strategy: 'detour', blockedCount: 0, candidatesChecked: checked };

    return {
      route: best,
      strategy: 'unavoidable',
      blockedCount: this.blockersOn(best, input.avoid).length,
      candidatesChecked: checked,
    };
  }

  /** Các sự cố mà tuyến đi xuyên qua (theo thứ tự xuất hiện dọc tuyến). */
  private blockersOn(route: RouteResult, avoid: BlockingIncident[]): BlockingIncident[] {
    return avoid
      .filter((incident) => routePassesNear(route.coordinates, incident, incident.radiusMeters))
      .sort(
        (a, b) => nearestSegment(a, route.coordinates).index - nearestSegment(b, route.coordinates).index,
      );
  }

  /** Tính tuyến đi qua từng điểm vòng tránh; điểm vòng được chèn đúng chặng chứa sự cố. */
  private async detourCandidates(
    input: RerouteRequest,
    best: RouteResult,
    blocker: BlockingIncident,
  ): Promise<RouteResult[]> {
    const routes: RouteResult[] = [];
    for (const detour of detourPoints(
      best.coordinates,
      blocker,
      blocker.radiusMeters + DETOUR_EXTRA_METERS,
    )) {
      try {
        const points = this.insertDetour(input, best, blocker, detour);
        routes.push(
          ...(await this.provider.calculateAlternatives({
            points,
            vehicle: input.vehicle,
            objective: input.objective,
          })),
        );
      } catch {
        // Điểm vòng rơi vào chỗ không có đường (sông, công viên…) thì bỏ qua, thử điểm còn lại.
      }
    }
    return routes;
  }

  /** Chèn điểm vòng trước điểm dừng đầu tiên nằm SAU sự cố dọc theo tuyến. */
  private insertDetour(
    input: RerouteRequest,
    best: RouteResult,
    blocker: BlockingIncident,
    detour: LatLng,
  ): LatLng[] {
    const incidentIndex = nearestSegment(blocker, best.coordinates).index;
    const insertAt = input.stops.findIndex(
      (stop) => nearestSegment(stop, best.coordinates).index >= incidentIndex,
    );
    const stops = [...input.stops];
    stops.splice(insertAt === -1 ? stops.length - 1 : insertAt, 0, detour);
    return [input.from, ...stops];
  }

  private cost(route: RouteResult, objective: RerouteRequest['objective']): number {
    return objective === 'distance' ? route.distanceMeters : route.durationSeconds;
  }
}
