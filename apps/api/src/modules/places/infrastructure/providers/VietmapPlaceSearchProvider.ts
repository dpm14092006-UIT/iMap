import { z } from 'zod';
import type { PlaceSuggestion } from '@routetwin/shared';
import {
  landmarkAlias,
  nameMatch,
  normalizePlaceText,
  rankPlaceSuggestions,
} from '../../domain/placeRanking.js';
import type { GeoFocus, PlaceSearchProvider } from '../../application/ports/PlaceSearchProvider.js';
import {
  invalidPlaceResponse,
  requestVietmapPlaces,
  tidyVietmapAddress,
  VIETMAP_DISPLAY_TYPE,
  vietmapPointSchema,
  type VietmapPlaceEndpoint,
} from './vietmapPlaceRequest.js';

const suggestionSchema = z.object({
  ref_id: z.string().min(1),
  name: z.string(),
  address: z.string(),
  display: z.string().optional(),
});
const normalized = normalizePlaceText;
const center: GeoFocus = { lat: 10.779, lng: 106.701 };

/** Autocomplete returns opaque references; resolve only the selected row, never every suggestion. */
export class VietmapPlaceSearchProvider implements PlaceSearchProvider {
  constructor(private readonly apiKey?: string) {}

  async suggest(
    query: string,
    focus: GeoFocus = center,
    kind: 'all' | 'street' = 'all',
  ): Promise<PlaceSuggestion[]> {
    const text = query.replace(/\b(DCT|ĐCT|DT|ĐT|QL|TL)(\d+)/gi, '$1 $2');
    const streetQuery = /^(duong|pho|quoc lo|tinh lo|ql|dt|dct|tl)\b/.test(normalized(text));
    const params: Record<string, string> = {
      text,
      focus: `${focus.lat},${focus.lng}`,
      display_type: VIETMAP_DISPLAY_TYPE,
      ...(kind === 'street' || streetQuery ? { layers: 'STREET' } : {}),
    };
    const parse = (payload: unknown) => {
      const data = z.array(suggestionSchema).safeParse(payload);
      if (!data.success) throw invalidPlaceResponse();
      // Do not offer an unrelated house number as if it matched the requested address.
      const house = kind === 'street' ? undefined : query.trim().match(/^(\d[\dA-Za-z/-]*)\s+/)?.[1];
      return data.data.filter(
        (item) =>
          !house || ` ${normalized(`${item.name} ${item.address}`)} `.includes(` ${normalized(house)} `),
      );
    };
    // Tên quen gọi của địa danh (vd. "Hồ Gươm" → "Hồ Hoàn Kiếm"): hỏi thêm tên chuẩn song song,
    // kết quả của tên chuẩn đứng trước. Chỉ tốn thêm một lượt gọi khi câu gõ đúng là một bí danh.
    const alias = kind === 'street' ? undefined : landmarkAlias(query);
    const [primary, canonical] = await Promise.all([
      this.request('autocomplete', params),
      alias ? this.request('autocomplete', { ...params, text: alias }).catch(() => []) : [],
    ]);
    // Từ tên chuẩn chỉ lấy chính địa danh đó (vd. "Hồ Hoàn Kiếm"), không lấy các nơi khác chỉ bắt đầu bằng tên ấy.
    const aliasRows = alias ? parse(canonical).filter((item) => nameMatch(alias, item.name) >= 2) : [];
    let rows = [...aliasRows, ...parse(primary)];
    // Full-address geocoding is a second attempt only when type-ahead has no usable match.
    if (!rows.length) rows = parse(await this.request('search', params));
    return rankPlaceSuggestions(query, rows, alias)
      .slice(0, 10)
      .map((item) => ({
        id: item.ref_id,
        name: item.name || item.display || item.address,
        address: tidyVietmapAddress(item.address || item.display || ''),
        source: 'vietmap',
      }));
  }

  async resolve(id: string): Promise<PlaceSuggestion> {
    const data = vietmapPointSchema.safeParse(await this.request('place', { refid: id }));
    if (!data.success) throw invalidPlaceResponse();
    return {
      id,
      name: data.data.name || data.data.address || data.data.display || 'Địa điểm',
      address: tidyVietmapAddress(data.data.display || data.data.address || ''),
      lat: data.data.lat,
      lng: data.data.lng,
      source: 'vietmap',
    };
  }

  async reverse(point: GeoFocus): Promise<PlaceSuggestion | null> {
    const data = z.array(vietmapPointSchema.extend({ ref_id: z.string() })).safeParse(
      await this.request('reverse', {
        lat: String(point.lat),
        lng: String(point.lng),
        display_type: VIETMAP_DISPLAY_TYPE,
      }),
    );
    if (!data.success) throw invalidPlaceResponse();
    const item = data.data[0];
    return item
      ? {
          id: item.ref_id,
          name: item.name || item.address || 'Địa điểm',
          address: tidyVietmapAddress(item.display || item.address || ''),
          lat: item.lat,
          lng: item.lng,
          source: 'vietmap',
        }
      : null;
  }

  private request(endpoint: VietmapPlaceEndpoint, params: Record<string, string>): Promise<unknown> {
    return requestVietmapPlaces(this.apiKey, endpoint, params);
  }
}
