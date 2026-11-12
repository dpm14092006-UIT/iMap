import { describe, expect, it, vi } from 'vitest';
import type { PoiSearchProvider } from '../../application/ports/PoiSearchProvider.js';
import { CachedPoiSearchProvider } from './CachedPoiSearchProvider.js';

function setup() {
  let clock = 0;
  const inner = {
    search: vi.fn().mockResolvedValue([]),
    locate: vi.fn().mockImplementation(async (id: string) => ({ id, name: id, address: '', lat: 1, lng: 2 })),
  } satisfies PoiSearchProvider;
  const cached = new CachedPoiSearchProvider(inner, () => clock);
  return { inner, cached, advance: (ms: number) => (clock += ms) };
}
const request = {
  text: 'xăng',
  center: { lat: 10.8001, lng: 106.7502 },
  radiusM: 1500,
  categoryCodes: ['1'],
};

describe('CachedPoiSearchProvider', () => {
  it('dùng lại Place v4 theo ref_id trong 24 giờ rồi gọi lại', async () => {
    const { inner, cached, advance } = setup();
    await cached.locate('a');
    await cached.locate('a');
    expect(inner.locate).toHaveBeenCalledTimes(1);
    advance(24 * 60 * 60_000 + 1);
    await cached.locate('a');
    expect(inner.locate).toHaveBeenCalledTimes(2);
  });

  it('cache kết quả tìm kiếm 10 phút theo tâm làm tròn 3 số', async () => {
    const { inner, cached, advance } = setup();
    await cached.search(request);
    await cached.search({ ...request, center: { lat: 10.8004, lng: 106.7498 } });
    expect(inner.search).toHaveBeenCalledTimes(1);
    await cached.search({ ...request, radiusM: 1000 });
    await cached.search({ ...request, text: 'phở' });
    expect(inner.search).toHaveBeenCalledTimes(3);
    advance(10 * 60_000 + 1);
    await cached.search(request);
    expect(inner.search).toHaveBeenCalledTimes(4);
  });

  it('không cache lỗi', async () => {
    const { inner, cached } = setup();
    inner.search.mockRejectedValueOnce(new Error('boom'));
    await expect(cached.search(request)).rejects.toThrow('boom');
    await cached.search(request);
    expect(inner.search).toHaveBeenCalledTimes(2);
  });
});
