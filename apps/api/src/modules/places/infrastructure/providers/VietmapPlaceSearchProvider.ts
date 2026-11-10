import { z } from 'zod';
import type { PlaceSuggestion } from '@routetwin/shared';
import type { GeoFocus, PlaceSearchProvider } from '../../application/ports/PlaceSearchProvider.js';
import { AppError } from '../../../../shared/errors/AppError.js';

const suggestionSchema = z.object({ ref_id: z.string().min(1), name: z.string(), address: z.string(), display: z.string().optional() });
const pointSchema = z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180), name: z.string().optional(), address: z.string().optional(), display: z.string().optional() });
function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(dct|dt|ql|tl)(\d+)/g, '$1 $2').trim();
}

/** Promote direct POI names over businesses that only contain the destination name. Ties retain provider ranking. */
function nameMatch(query: string, name: string) {
  const stripRoad = (text: string) => text.replace(/^(duong|pho) /, '');
  const q = stripRoad(normalized(query)), n = stripRoad(normalized(name));
  if (q === n) return 3;
  if (n.split(' ').length >= 2 && q.startsWith(`${n} `)) return 2;
  if (n.startsWith(`${q} `)) return 1;
  return 0;
}
const center: GeoFocus = { lat: 10.779, lng: 106.701 };

/** Autocomplete returns opaque references; resolve only the selected row, never every suggestion. */
export class VietmapPlaceSearchProvider implements PlaceSearchProvider {
  constructor(private readonly apiKey?: string) {}

  async suggest(query: string, focus: GeoFocus = center, kind: 'all' | 'street' = 'all'): Promise<PlaceSuggestion[]> {
    const text = query.replace(/\b(DCT|ĐCT|DT|ĐT|QL|TL)(\d+)/gi, '$1 $2');
    const streetQuery = /^(duong|pho|quoc lo|tinh lo|ql|dt|dct|tl)\b/.test(normalized(text));
    const params: Record<string, string> = { text, focus: `${focus.lat},${focus.lng}`, display_type: '6', ...(kind === 'street' || streetQuery ? { layers: 'STREET' } : {}) };
    const parse = (payload: unknown) => {
      const data = z.array(suggestionSchema).safeParse(payload);
      if (!data.success) throw this.invalidResponse();
      // Do not offer an unrelated house number as if it matched the requested address.
      const house = kind === 'street' ? undefined : query.trim().match(/^(\d[\dA-Za-z/\-]*)\s+/)?.[1];
      return data.data.filter((item) => !house || ` ${normalized(`${item.name} ${item.address}`)} `.includes(` ${normalized(house)} `));
    };
    let rows = parse(await this.request('autocomplete', params));
    // Full-address geocoding is a second attempt only when type-ahead has no usable match.
    if (!rows.length) rows = parse(await this.request('search', params));
    return rows.sort((a, b) => nameMatch(query, b.name) - nameMatch(query, a.name)).slice(0, 10).map((item) => ({ id: item.ref_id, name: item.name || item.display || item.address, address: item.address || item.display || '', source: 'vietmap' }));
  }

  async resolve(id: string): Promise<PlaceSuggestion> {
    const data = pointSchema.safeParse(await this.request('place', { refid: id }));
    if (!data.success) throw this.invalidResponse();
    return { id, name: data.data.name || data.data.address || data.data.display || 'Địa điểm', address: data.data.display || data.data.address || '', lat: data.data.lat, lng: data.data.lng, source: 'vietmap' };
  }

  async reverse(point: GeoFocus): Promise<PlaceSuggestion | null> {
    const data = z.array(pointSchema.extend({ ref_id: z.string() })).safeParse(await this.request('reverse', {
      lat: String(point.lat), lng: String(point.lng), display_type: '6',
    }));
    if (!data.success) throw this.invalidResponse();
    const item = data.data[0];
    return item ? { id: item.ref_id, name: item.name || item.address || 'Địa điểm', address: item.display || item.address || '', lat: item.lat, lng: item.lng, source: 'vietmap' } : null;
  }

  private invalidResponse() { return new AppError(502, 'PLACE_SEARCH_INVALID_RESPONSE', 'VietMap trả về dữ liệu địa điểm không hợp lệ.'); }

  private async request(endpoint: 'autocomplete' | 'search' | 'place' | 'reverse', params: Record<string, string>): Promise<unknown> {
    if (!this.apiKey) throw new AppError(503, 'PLACE_SEARCH_NOT_CONFIGURED', 'Chưa cấu hình VietMap Search ở máy chủ.');
    const url = new URL(`https://maps.vietmap.vn/api/${endpoint}/v4`);
    url.search = new URLSearchParams({ ...params, apikey: this.apiKey }).toString();
    let response: Response;
    try { response = await fetch(url, { signal: AbortSignal.timeout(8000) }); }
    catch { throw new AppError(502, 'PLACE_SEARCH_UNAVAILABLE', 'Không kết nối được VietMap Search. Hãy thử lại.'); }
    if (response.status === 401 || response.status === 403) throw new AppError(502, 'PLACE_SEARCH_AUTH', 'Key VietMap chưa được cấp quyền tìm địa điểm.');
    if (response.status === 429 || response.status === 423) throw new AppError(429, 'PLACE_SEARCH_QUOTA', 'VietMap Search đã đạt hạn mức hoặc chưa được bật.');
    if (!response.ok) throw new AppError(502, 'PLACE_SEARCH_UNAVAILABLE', 'VietMap Search đang bận. Hãy thử lại.');
    try { return await response.json(); } catch { throw this.invalidResponse(); }
  }
}
