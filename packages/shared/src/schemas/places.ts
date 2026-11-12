import { z } from 'zod';

export type PlaceSuggestion = {
  id: string;
  name: string;
  address: string;
  source?: 'vietmap' | 'osm';
  lat?: number;
  lng?: number;
};

/** Danh mục địa điểm có chip riêng trên giao diện; từ khóa tự do thì không thuộc danh mục nào. */
export const poiCategories = [
  'restaurant',
  'cafe',
  'hotel',
  'attraction',
  'museum',
  'bus',
  'pharmacy',
  'atm',
  'fuel',
  'ev',
] as const;
export const poiCategorySchema = z.enum(poiCategories);
export type PoiCategory = z.infer<typeof poiCategorySchema>;

export const poiRadiusLimits = { min: 250, max: 5000, default: 1500 } as const;
export const poiLimits = { default: 20, max: 30 } as const;
export const poiPathMaxPoints = 500;

const poiSearchTermSchema = {
  query: z.string().trim().min(1).max(80).optional(),
  category: poiCategorySchema.optional(),
  radiusM: z
    .number()
    .int()
    .min(poiRadiusLimits.min)
    .max(poiRadiusLimits.max)
    .default(poiRadiusLimits.default),
  limit: z.number().int().min(1).max(poiLimits.max).default(poiLimits.default),
};
const hasSearchTerm = (value: { query?: string | undefined; category?: PoiCategory | undefined }) =>
  Boolean(value.query || value.category);
const missingTerm = { message: 'Cần nhập từ khóa hoặc chọn danh mục.', path: ['query'] };

/** POST /api/places/along-route. `path` là [vĩ độ, kinh độ][]. */
export const alongRoutePoiRequestSchema = z
  .object({
    path: z
      .array(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]))
      .min(2)
      .max(poiPathMaxPoints),
    ...poiSearchTermSchema,
  })
  .refine(hasSearchTerm, missingTerm);
export type AlongRoutePoiRequest = z.infer<typeof alongRoutePoiRequestSchema>;

/** GET /api/places/nearby (query string, nên ép kiểu số). */
export const nearbyPoiRequestSchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    query: poiSearchTermSchema.query,
    category: poiSearchTermSchema.category,
    radiusM: z.coerce
      .number()
      .int()
      .min(poiRadiusLimits.min)
      .max(poiRadiusLimits.max)
      .default(poiRadiusLimits.default),
    limit: z.coerce.number().int().min(1).max(poiLimits.max).default(poiLimits.default),
  })
  .refine(hasSearchTerm, missingTerm);
export type NearbyPoiRequest = z.infer<typeof nearbyPoiRequestSchema>;

/**
 * Một địa điểm thật từ VietMap. Tìm dọc tuyến: có `distanceFromRouteM`, `positionAlongRouteM`, `detourMin`.
 * Tìm quanh đây: ba trường đó bằng 0 và `distanceFromCenterM` là khoảng cách tới tâm.
 */
export type PoiResult = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: PoiCategory | null;
  categoryCodes: string[];
  distanceFromRouteM: number;
  /** Vị trí hình chiếu trên tuyến, mét tính từ điểm đầu. */
  positionAlongRouteM: number;
  /** Thời gian đi vòng ước tính, phút. */
  detourMin: number;
  distanceFromCenterM?: number;
};
