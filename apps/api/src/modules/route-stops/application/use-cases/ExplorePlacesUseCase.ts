import {
  explorePlacesRequestSchema,
  stopIntentSchema,
  type ExplorePlacesRequest,
  type ExplorePlacesResponse,
} from '@routetwin/shared';
import type { StopIntentParser } from '../ports/StopIntentParser.js';
import type { StopPlaceProvider } from '../ports/StopPlaceProvider.js';
import type { FindRouteStopsUseCase } from './FindRouteStopsUseCase.js';
import { distanceMeters, routeBounds } from '../../domain/route-geometry.js';
import { AppError } from '../../../../shared/errors/AppError.js';
export class ExplorePlacesUseCase {
  constructor(
    private readonly parser: StopIntentParser,
    private readonly places: StopPlaceProvider,
    private readonly routeStops: FindRouteStopsUseCase,
  ) {}
  async execute(input: ExplorePlacesRequest): Promise<ExplorePlacesResponse> {
    const request = explorePlacesRequestSchema.parse(input);
    const parsed = await this.parser.parse(request.query, request.context);
    const intent = stopIntentSchema.parse(parsed.intent);
    const category = request.category ?? intent.category;
    const warnings = [...intent.unsupportedRequirements, ...(parsed.warning ? [parsed.warning] : [])];
    if (category === 'unknown')
      return {
        status: 'clarify',
        source: parsed.source,
        question: intent.clarificationQuestion ?? 'Bạn muốn tìm loại địa điểm nào?',
        suggestions: intent.suggestedCategories,
        warnings,
      };
    if (request.mode === 'route') {
      if (!request.points)
        return {
          status: 'needs_route',
          source: parsed.source,
          message: 'Hãy tính tuyến hai điểm trước, hoặc chọn tìm quanh vị trí trên bản đồ.',
        };
      const routeStops = await this.routeStops.execute(
        {
          query: request.query,
          points: request.points,
          vehicle: request.vehicle,
          category,
          maxExtraDistanceMeters: request.maxExtraDistanceMeters,
          maxExtraDurationSeconds: request.maxExtraDurationSeconds,
        },
        parsed,
      );
      return {
        status: 'results',
        mode: 'route',
        source: parsed.source,
        category,
        routeStops,
        warnings: routeStops.warnings,
        searchedAt: routeStops.searchedAt,
      };
    }
    if (!request.center)
      return {
        status: 'needs_location',
        source: parsed.source,
        message: 'Chọn một vị trí hoặc dùng tâm bản đồ để tìm gần đó.',
      };
    const radiusMeters = request.radiusMeters ?? intent.nearbyRadiusMeters ?? 2000;
    const center: [number, number] = [request.center.lng, request.center.lat];
    const bounds = routeBounds([center], radiusMeters);
    if (bounds.south < -90 || bounds.north > 90 || bounds.west < -180 || bounds.east > 180)
      throw new AppError(422, 'PLACE_AREA_LIMIT', 'Vị trí này chưa được hỗ trợ. Hãy chọn lại trên bản đồ.');
    const found = await this.places.search(category, bounds);
    const seen = new Set<string>();
    const places = found
      .flatMap((place) => {
        const distance = distanceMeters(center, [place.lng, place.lat]);
        if (distance > radiusMeters || seen.has(place.id)) return [];
        seen.add(place.id);
        return [{ place, distanceMeters: Math.round(distance) }];
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 8);
    return {
      status: 'results',
      mode: 'nearby',
      source: parsed.source,
      category,
      places,
      radiusMeters,
      warnings: [
        'Khoảng cách hiển thị là đường thẳng, chưa phải quãng đường lái xe. Dữ liệu OSM có thể thiếu hoặc cũ; chưa xác minh giờ mở cửa/lối vào.',
        ...warnings,
      ],
      searchedAt: new Date().toISOString(),
    };
  }
}
