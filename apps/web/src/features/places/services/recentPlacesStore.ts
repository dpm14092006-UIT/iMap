import { getSupabaseClient } from '../../auth/services/supabaseClient';
import {
  emptyRecentPlaces,
  MAX_RECENT_PLACES,
  parseRecentPlaceList,
  placeSources,
  recentPlaceKey,
  type RecentPlaceKind,
  type RecentPlaces,
} from '../domain/recentPlaces';
import type { Place, PlaceSource } from '../types';

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

export function readCachedRecentPlaces(userId: string): RecentPlaces {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    const parsed = raw ? (JSON.parse(raw) as Partial<Record<RecentPlaceKind, unknown>> | null) : null;
    return {
      origin: parseRecentPlaceList(parsed?.origin),
      destination: parseRecentPlaceList(parsed?.destination),
    };
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
