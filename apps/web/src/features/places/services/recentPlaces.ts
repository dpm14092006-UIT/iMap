import { getSupabaseClient } from '../../auth/services/supabaseClient';
import type { Place, PlaceSource } from '../types';

export type RecentPlaceKind = 'origin' | 'destination';
export type RecentPlaces = Record<RecentPlaceKind, Place[]>;

export const MAX_RECENT_PLACES = 10;
export const emptyRecentPlaces = (): RecentPlaces => ({ origin: [], destination: [] });

type DbRecentPlace = {
  kind: RecentPlaceKind;
  place_key: string;
  name: string;
  address: string;
  category: string;
  lat: number;
  lng: number;
  source: string;
};

const placeSources: PlaceSource[] = ['popular', 'osm', 'vietmap', 'map', 'gps', 'poi'];

/** Khóa chống trùng: cùng tên và cùng chỗ (~10 m) coi là một điểm. */
export function recentPlaceKey(place: Place): string {
  return `${place.name.trim().toLocaleLowerCase('vi')}|${place.lat.toFixed(4)}|${place.lng.toFixed(4)}`.slice(
    0,
    200,
  );
}

/** Vị trí GPS hiện tại không có ích khi chọn lại sau này nên không lưu vào lịch sử. */
export function isRecordablePlace(place: Place | null | undefined): place is Place {
  return Boolean(place && place.source !== 'gps' && place.name.trim() && Number.isFinite(place.lat));
}

/** Thêm điểm lên đầu danh sách, bỏ trùng, giữ tối đa 10. */
export function pushRecentPlace(list: Place[], place: Place): Place[] {
  const key = recentPlaceKey(place);
  return [place, ...list.filter((item) => recentPlaceKey(item) !== key)].slice(0, MAX_RECENT_PLACES);
}

/** Một thao tác trên máy (thêm / xóa) cần áp lại sau khi tải danh sách từ server. */
export type RecentPlaceEdit =
  | { type: 'record'; kind: RecentPlaceKind; place: Place }
  | { type: 'remove'; kind: RecentPlaceKind; key: string };

/** Áp một thao tác lên danh sách lịch sử. */
export function applyRecentPlaceEdit(places: RecentPlaces, edit: RecentPlaceEdit): RecentPlaces {
  const list = places[edit.kind];
  const next =
    edit.type === 'record'
      ? pushRecentPlace(list, edit.place)
      : list.filter((item) => recentPlaceKey(item) !== edit.key);
  return { ...places, [edit.kind]: next };
}

/**
 * Danh sách server có thể về SAU khi người dùng vừa thêm/xóa trên máy (lúc đó server chưa ghi xong).
 * Áp lại các thao tác đó theo thứ tự lên kết quả server để không mất mục vừa thêm hay hiện lại mục vừa xóa.
 */
export function mergeRemoteRecentPlaces(remote: RecentPlaces, pendingEdits: RecentPlaceEdit[]): RecentPlaces {
  return pendingEdits.reduce(applyRecentPlaceEdit, remote);
}

function toPlace(row: DbRecentPlace): Place {
  return {
    id: `recent-${row.place_key}`,
    name: row.name,
    address: row.address,
    category: row.category,
    lat: Number(row.lat),
    lng: Number(row.lng),
    source: placeSources.includes(row.source as PlaceSource) ? (row.source as PlaceSource) : 'map',
  };
}

const cacheKey = (userId: string) => `imap.recentPlaces.${userId}`;

/**
 * Kiểm tra một phần tử đọc từ localStorage (có thể hỏng hoặc từ bản app cũ).
 * Thiếu tên hay tọa độ thì bỏ, vì recentPlaceKey() sẽ ném lỗi và làm sập app.
 */
function cachedPlace(value: unknown): Place | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<Record<keyof Place, unknown>>;
  if (typeof item.name !== 'string' || !item.name.trim()) return null;
  if (typeof item.lat !== 'number' || !Number.isFinite(item.lat)) return null;
  if (typeof item.lng !== 'number' || !Number.isFinite(item.lng)) return null;
  return {
    id: typeof item.id === 'string' ? item.id : `recent-${item.lat},${item.lng}`,
    name: item.name,
    address: typeof item.address === 'string' ? item.address : '',
    category: typeof item.category === 'string' ? item.category : '',
    lat: item.lat,
    lng: item.lng,
    source: placeSources.includes(item.source as PlaceSource) ? (item.source as PlaceSource) : 'map',
  };
}

function cachedList(value: unknown): Place[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(cachedPlace)
    .filter((place): place is Place => place !== null)
    .slice(0, MAX_RECENT_PLACES);
}

export function readCachedRecentPlaces(userId: string): RecentPlaces {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    const parsed = raw ? (JSON.parse(raw) as Partial<Record<RecentPlaceKind, unknown>> | null) : null;
    return { origin: cachedList(parsed?.origin), destination: cachedList(parsed?.destination) };
  } catch {
    return emptyRecentPlaces();
  }
}

export function writeCachedRecentPlaces(userId: string, places: RecentPlaces): void {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(places));
  } catch {
    // Không lưu được bản sao trên máy thì vẫn còn bản trên tài khoản.
  }
}

/** Lịch sử theo tài khoản trên Supabase (bảng recent_places, RLS chỉ đọc được của mình). */
export class RecentPlacesRepository {
  async list(): Promise<RecentPlaces | null> {
    const client = await getSupabaseClient();
    if (!client) return null;
    const load = (kind: RecentPlaceKind) =>
      client
        .from('recent_places')
        .select('kind, place_key, name, address, category, lat, lng, source')
        .eq('kind', kind)
        .order('used_at', { ascending: false })
        .limit(MAX_RECENT_PLACES);
    const [origins, destinations] = await Promise.all([load('origin'), load('destination')]);
    if (origins.error || destinations.error) return null;
    return {
      origin: ((origins.data ?? []) as DbRecentPlace[]).map(toPlace),
      destination: ((destinations.data ?? []) as DbRecentPlace[]).map(toPlace),
    };
  }

  /** Supabase trả `{ error }` thay vì ném lỗi; ném ra để nơi gọi biết đồng bộ thất bại. */
  async record(kind: RecentPlaceKind, place: Place): Promise<void> {
    const client = await getSupabaseClient();
    if (!client) return;
    const { error } = await client.rpc('record_recent_place', {
      p_kind: kind,
      p_place_key: recentPlaceKey(place),
      p_name: place.name.slice(0, 200),
      p_address: place.address.slice(0, 300),
      p_category: place.category.slice(0, 80),
      p_lat: place.lat,
      p_lng: place.lng,
      p_source: place.source,
    });
    if (error) throw new Error(`Không lưu được lịch sử địa điểm: ${error.message}`);
  }

  async remove(kind: RecentPlaceKind, place: Place): Promise<void> {
    const client = await getSupabaseClient();
    if (!client) return;
    const { error } = await client
      .from('recent_places')
      .delete()
      .eq('kind', kind)
      .eq('place_key', recentPlaceKey(place));
    if (error) throw new Error(`Không xóa được lịch sử địa điểm: ${error.message}`);
  }
}
