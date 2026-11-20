import type { Place, PlaceSource } from '../types';

/** Lịch sử 10 điểm đi / 10 điểm đến gần nhất: quy tắc thuần, không I/O. */

export type RecentPlaceKind = 'origin' | 'destination';
export type RecentPlaces = Record<RecentPlaceKind, Place[]>;

export const MAX_RECENT_PLACES = 10;
export const emptyRecentPlaces = (): RecentPlaces => ({ origin: [], destination: [] });

export const placeSources: PlaceSource[] = ['popular', 'osm', 'vietmap', 'map', 'gps', 'poi'];

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

/** Điểm này đã đứng đầu danh sách chưa (ghi lại cũng không đổi gì, khỏi gọi server). */
export function isMostRecentPlace(list: Place[], place: Place): boolean {
  return Boolean(list[0] && recentPlaceKey(list[0]) === recentPlaceKey(place));
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

/**
 * Kiểm tra một phần tử lịch sử đọc từ bên ngoài (localStorage, bản app cũ) — có thể hỏng.
 * Thiếu tên hay tọa độ thì bỏ, vì recentPlaceKey() sẽ ném lỗi và làm sập app.
 */
export function parseRecentPlace(value: unknown): Place | null {
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

/** Danh sách lịch sử đã kiểm tra từng phần tử, tối đa MAX_RECENT_PLACES mục. */
export function parseRecentPlaceList(value: unknown): Place[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseRecentPlace)
    .filter((place): place is Place => place !== null)
    .slice(0, MAX_RECENT_PLACES);
}
