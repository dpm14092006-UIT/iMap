import type { PoiCategory, PoiResult } from '@routetwin/shared';
import type { Coordinate } from '../map/types';
import type { LatLng } from '../places/types';

export type { PoiCategory };

/** Địa điểm thật từ VietMap (DTO của backend dùng nguyên). */
export type Poi = PoiResult;

/** Người dùng chọn danh mục (có mã VietMap) hoặc gõ từ khóa tự do. */
export type PoiSearchTerm = { category?: PoiCategory; query?: string };

/** Theo tuyến, Gần nhất, hoặc Ít đi vòng nhất. */
export type PoiSort = 'route' | 'distance' | 'detour';

/** Nguồn dữ liệu POI; cài đặt thật là ApiPoiProvider gọi backend. */
export interface PoiProvider {
  nearby(center: LatLng, term: PoiSearchTerm, radiusM: number, signal?: AbortSignal): Promise<Poi[]>;
  alongRoute(path: Coordinate[], term: PoiSearchTerm, radiusM: number, signal?: AbortSignal): Promise<Poi[]>;
}
