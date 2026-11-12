import { z } from 'zod';
import type {
  PoiCandidate,
  PoiLocation,
  PoiSearchProvider,
  PoiSearchRequest,
} from '../../application/ports/PoiSearchProvider.js';
import { invalidPlaceResponse, requestVietmapPlaces } from './vietmapPlaceRequest.js';

const candidateSchema = z.object({
  ref_id: z.string().min(1),
  name: z.string().optional(),
  address: z.string().optional(),
  display: z.string().optional(),
  /** Km tính từ `focus`. */
  distance: z.number().finite().nonnegative().optional(),
  categories: z.array(z.union([z.string(), z.number()])).optional(),
});
const placeSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  name: z.string().optional(),
  address: z.string().optional(),
  display: z.string().optional(),
});

/** Tìm POI bằng VietMap Autocomplete v4 (thử Search v4 khi rỗng); toạ độ lấy bằng Place v4. */
export class VietmapPoiSearchProvider implements PoiSearchProvider {
  constructor(private readonly apiKey?: string) {}

  async search(request: PoiSearchRequest): Promise<PoiCandidate[]> {
    const center = `${request.center.lat},${request.center.lng}`;
    const params: Record<string, string> = {
      text: request.text,
      focus: center,
      circle_center: center,
      circle_radius: String(Math.round(request.radiusM)),
      layers: 'POI',
      display_type: '6',
      ...(request.categoryCodes.length ? { cats: request.categoryCodes.join(',') } : {}),
    };
    const parse = (payload: unknown) => {
      const rows = z.array(candidateSchema).safeParse(payload);
      if (!rows.success) throw invalidPlaceResponse();
      return rows.data;
    };
    let rows = parse(await requestVietmapPlaces(this.apiKey, 'autocomplete', params));
    if (!rows.length) rows = parse(await requestVietmapPlaces(this.apiKey, 'search', params));
    return rows.map((row) => ({
      id: row.ref_id,
      name: row.name || row.display || row.address || '',
      address: row.address || '',
      categoryCodes: (row.categories ?? []).map(String),
      distanceM: row.distance === undefined ? undefined : row.distance * 1000,
    }));
  }

  async locate(id: string): Promise<PoiLocation> {
    const place = placeSchema.safeParse(await requestVietmapPlaces(this.apiKey, 'place', { refid: id }));
    if (!place.success) throw invalidPlaceResponse();
    const name = place.data.name ?? '';
    // `display` có dạng "Tên, địa chỉ"; giữ phần địa chỉ để không lặp tên trên thẻ.
    const display = place.data.display ?? '';
    const address = display.startsWith(`${name}, `) ? display.slice(name.length + 2) : display;
    return {
      id,
      name,
      address: address || place.data.address || '',
      lat: place.data.lat,
      lng: place.data.lng,
    };
  }
}
