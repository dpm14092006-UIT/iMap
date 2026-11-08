import { routeStopRequestSchema, stopIntentSchema, type RouteStopCandidate, type RouteStopRequest, type RouteStopResponse, type StopCategory } from '@routetwin/shared';
import type { RouteProvider } from '../../../navigation/domain/ports/RouteProvider.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import type { StopIntentParser } from '../ports/StopIntentParser.js';
import type { StopPlaceProvider } from '../ports/StopPlaceProvider.js';
import { distanceMeters, projectOnRoute, routeBounds } from '../../domain/route-geometry.js';
const CORRIDOR_METERS = 1500;
const MAX_ROUTED_CANDIDATES = 4;
const criticalRouteCodes = new Set(['VIETMAP_NOT_CONFIGURED', 'ROUTE_PROVIDER_AUTH', 'ROUTE_PROVIDER_QUOTA', 'ROUTE_PROVIDER_RATE_LIMIT']);
export class FindRouteStopsUseCase {
  constructor(private readonly routes: RouteProvider, private readonly places: StopPlaceProvider, private readonly parser: StopIntentParser) {}
  async execute(input: RouteStopRequest, resolvedIntent?: Awaited<ReturnType<StopIntentParser['parse']>>): Promise<RouteStopResponse> {
    const request = routeStopRequestSchema.parse(input);
    const [origin, destination] = request.points;
    if (distanceMeters([origin!.lng, origin!.lat], [destination!.lng, destination!.lat]) < 20) throw new AppError(400, 'STOP_ROUTE_TOO_SHORT', 'Điểm đi và điểm đến cần cách nhau ít nhất 20 m.');
    // Validate AI interpretation before any external routing calls.
    const interpretation = resolvedIntent ?? await this.parser.parse(request.query);
    const intent = stopIntentSchema.parse(interpretation.intent);
    const category = request.category ?? intent.category;
    if (category === 'unknown') throw new AppError(422, 'STOP_CATEGORY_UNCLEAR', 'Hãy chọn một loại địa điểm để tìm kiếm.');
    const maxExtraDistanceMeters = request.maxExtraDistanceMeters ?? intent.maxExtraDistanceMeters ?? 2000;
    const maxExtraDurationSeconds = request.maxExtraDurationSeconds ?? intent.maxExtraDurationSeconds ?? 900;
    const baseline = await this.routes.calculate({ points: request.points, vehicle: request.vehicle, objective: 'duration' });
    if (baseline.distanceMeters > 80000 || baseline.coordinates.length < 2 || baseline.coordinates.length > 30000) throw new AppError(422, 'STOP_ROUTE_LIMIT', 'Tìm điểm dừng hiện hỗ trợ tuyến trong đô thị dài tối đa 80 km.');
    const bounds = routeBounds(baseline.coordinates, CORRIDOR_METERS);
    if (bounds.north - bounds.south > 0.7 || bounds.east - bounds.west > 0.7) throw new AppError(422, 'STOP_SEARCH_AREA_LIMIT', 'Tuyến trải trên khu vực quá rộng. Hãy chọn một chặng ngắn hơn.');
    const found = await this.places.search(category as StopCategory, bounds);
    const seen = new Set<string>();
    const shortlist = found.flatMap((place) => {
      if (seen.has(place.id)) return [];
      seen.add(place.id);
      const projection = projectOnRoute([place.lng, place.lat], baseline.coordinates);
      if (projection.distance > CORRIDOR_METERS) return [];
      return [{ place, ...projection }];
    }).sort((a, b) => a.distance - b.distance || a.progress - b.progress).slice(0, MAX_ROUTED_CANDIDATES);
    const candidates: RouteStopCandidate[] = [];
    let failed = 0;
    // Two at a time bounds upstream load; distance-to-line is only a shortlist heuristic.
    for (let i = 0; i < shortlist.length; i += 2) {
      const batch = await Promise.allSettled(shortlist.slice(i, i + 2).map(async ({ place }) => {
        try {
          const route = await this.routes.calculate({ points: [origin!, { lat: place.lat, lng: place.lng }, destination!], vehicle: request.vehicle, objective: 'duration' });
          const extraDistanceMeters = Math.max(0, route.distanceMeters - baseline.distanceMeters);
          const extraDurationSeconds = Math.max(0, route.durationSeconds - baseline.durationSeconds);
          if (extraDistanceMeters > maxExtraDistanceMeters || extraDurationSeconds > maxExtraDurationSeconds) return null;
          const reason = `Đi thêm ${(extraDistanceMeters / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} km và khoảng ${Math.ceil(extraDurationSeconds / 60)} phút so với tuyến không ghé. Chưa gồm thời gian dừng.`;
          return { place, insertAfterIndex: 0, extraDistanceMeters, extraDurationSeconds, reason, route };
        } catch (error) {
          if (error instanceof AppError && criticalRouteCodes.has(error.code)) throw error;
          failed++;
          return null;
        }
      }));
      for (const outcome of batch) {
        if (outcome.status === 'rejected') throw outcome.reason;
        if (outcome.value) candidates.push(outcome.value);
      }
    }
    if (shortlist.length && failed === shortlist.length) throw new AppError(502, 'STOP_ROUTES_UNAVAILABLE', 'Chưa tính được đường đi qua các điểm dừng. Vui lòng thử lại sau.');
    candidates.sort((a, b) => a.extraDurationSeconds - b.extraDurationSeconds || a.extraDistanceMeters - b.extraDistanceMeters);
    const warnings = [
      'Chỉ khảo sát tối đa 4 địa điểm gần hình học tuyến trong bán kính 1,5 km; không bảo đảm tối ưu trên toàn bộ địa điểm.',
      'Dữ liệu OpenStreetMap có thể thiếu hoặc cũ. Giờ mở cửa và lối vào chưa được xác minh; thời gian dự kiến chưa gồm lúc ghé.',
      ...intent.unsupportedRequirements,
    ];
    if (interpretation.warning) warnings.push(interpretation.warning);
    if (failed) warnings.push(`Chưa tính được tuyến qua ${failed} địa điểm; kết quả có thể chưa đầy đủ.`);
    return {
      interpretation: { source: interpretation.source, category, maxExtraDistanceMeters, maxExtraDurationSeconds },
      candidates: candidates.slice(0, 3), warnings, checkedCandidates: shortlist.length, searchedAt: new Date().toISOString(),
    };
  }
}
