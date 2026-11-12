import type {
  PoiCandidate,
  PoiLocation,
  PoiSearchProvider,
  PoiSearchRequest,
} from '../../application/ports/PoiSearchProvider.js';

type Entry<T> = { value: T; expiresAt: number };

/** Bộ nhớ đệm LRU có hạn dùng; Map giữ thứ tự chèn nên đưa mục vừa dùng xuống cuối. */
class TtlLruCache<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
    private readonly now: () => number,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    if (entry.expiresAt <= this.now()) return undefined;
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
  }
}

const round3 = (value: number) => value.toFixed(3);

/** Decorator thêm cache trong bộ nhớ: Place v4 theo `ref_id` (tính phí) 24 giờ, kết quả tìm kiếm 10 phút. */
export class CachedPoiSearchProvider implements PoiSearchProvider {
  private readonly places: TtlLruCache<PoiLocation>;
  private readonly searches: TtlLruCache<PoiCandidate[]>;

  constructor(
    private readonly inner: PoiSearchProvider,
    now: () => number = Date.now,
  ) {
    this.places = new TtlLruCache(2000, 24 * 60 * 60_000, now);
    this.searches = new TtlLruCache(500, 10 * 60_000, now);
  }

  async search(request: PoiSearchRequest): Promise<PoiCandidate[]> {
    const key = JSON.stringify([
      request.text,
      [...request.categoryCodes].sort(),
      round3(request.center.lat),
      round3(request.center.lng),
      request.radiusM,
    ]);
    const hit = this.searches.get(key);
    if (hit) return hit;
    const value = await this.inner.search(request);
    this.searches.set(key, value);
    return value;
  }

  async locate(id: string): Promise<PoiLocation> {
    const hit = this.places.get(id);
    if (hit) return hit;
    const value = await this.inner.locate(id);
    this.places.set(id, value);
    return value;
  }
}
