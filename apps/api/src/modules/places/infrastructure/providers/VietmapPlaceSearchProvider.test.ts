import { afterEach, describe, expect, it, vi } from 'vitest';
import { VietmapPlaceSearchProvider } from './VietmapPlaceSearchProvider.js';
afterEach(() => vi.unstubAllGlobals());
const provider = () => new VietmapPlaceSearchProvider('test-key');
function mock(body: unknown, status = 200) {
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
describe('VietMap place search', () => {
  it('keeps suggestions without inventing coordinates; sends focus and preserves opaque reference', async () => {
    const fetcher = mock([
      {
        ref_id: 'auto:a+b/==',
        name: 'THPT Trường Chinh',
        address: 'Quận 12',
        display: 'THPT Trường Chinh, Quận 12',
      },
    ]);
    expect(await provider().suggest('THPT Truong Chinh', { lat: 10.85, lng: 106.63 })).toEqual([
      { id: 'auto:a+b/==', name: 'THPT Trường Chinh', address: 'Quận 12', source: 'vietmap' },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = new URL(fetcher.mock.calls[0]![0]);
    expect(url.pathname).toBe('/api/autocomplete/v4');
    expect(url.searchParams.get('focus')).toBe('10.85,106.63');
    expect(url.searchParams.get('text')).toBe('THPT Truong Chinh');
  });
  it('prioritizes the named bridge over a business containing its name, including unaccented input', async () => {
    mock([
      { ref_id: 'shop', name: 'Hạt Giống Cầu Rồng Đà Nẵng', address: 'Đà Nẵng' },
      { ref_id: 'bridge', name: 'Cầu Rồng', address: 'Hải Châu, Đà Nẵng' },
      { ref_id: 'bridge-entrance', name: 'Cầu Rồng', address: 'Sơn Trà, Đà Nẵng' },
    ]);
    expect((await provider().suggest('Cau Rong Da Nang')).map((place) => place.id)).toEqual([
      'bridge',
      'bridge-entrance',
      'shop',
    ]);
  });
  it('normalizes road codes and requests the STREET layer when filtering roads', async () => {
    const fetcher = mock([{ ref_id: 'road', name: 'Đường DCT 9', address: 'Quận 12' }]);
    expect(await provider().suggest('DCT9', { lat: 10.85, lng: 106.63 }, 'street')).toMatchObject([
      { name: 'Đường DCT 9' },
    ]);
    const url = new URL(fetcher.mock.calls[0]![0]);
    expect(url.searchParams.get('text')).toBe('DCT 9');
    expect(url.searchParams.get('layers')).toBe('STREET');
  });
  it('does not treat a road named after a date as a missing house number in street mode', async () => {
    mock([{ ref_id: 'road', name: 'Đường 30 Tháng 4', address: 'Cần Thơ' }]);
    expect(await provider().suggest('30/4 Cần Thơ', undefined, 'street')).toHaveLength(1);
  });
  it('resolves only the selected opaque ref with URL encoding', async () => {
    const fetcher = mock({
      name: '',
      address: 'Đường DN11',
      display: 'Đường DN11, Quận 12',
      lat: 10.85,
      lng: 106.63,
    });
    expect(await provider().resolve('auto:a+b/==')).toMatchObject({
      id: 'auto:a+b/==',
      lat: 10.85,
      lng: 106.63,
    });
    expect(new URL(fetcher.mock.calls[0]![0]).searchParams.get('refid')).toBe('auto:a+b/==');
  });
  it('rejects missing or invalid coordinates instead of selecting a fake point', async () => {
    mock({ name: 'School', lat: 999, lng: 106 });
    await expect(provider().resolve('ref')).rejects.toMatchObject({ code: 'PLACE_SEARCH_INVALID_RESPONSE' });
  });
  it.each([
    [403, 'PLACE_SEARCH_AUTH'],
    [429, 'PLACE_SEARCH_QUOTA'],
    [423, 'PLACE_SEARCH_QUOTA'],
  ])('reports provider status %s without exposing key', async (status, code) => {
    mock({}, Number(status));
    await expect(provider().suggest('School')).rejects.toMatchObject({ code });
  });
  it('tries full-address Search only when autocomplete has no usable address', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ ref_id: 'wrong', name: '17 Đường DCT9', address: 'Quận 12' }])),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ ref_id: 'exact', name: '9G7 DCT9', address: 'Quận 12' }])),
      );
    vi.stubGlobal('fetch', fetcher);
    expect(await provider().suggest('9G7 DCT9')).toMatchObject([{ id: 'exact' }]);
    expect(new URL(fetcher.mock.calls[1]![0]).pathname).toBe('/api/search/v4');
  });
  it('returns no suggestions for empty results', async () => {
    mock([]);
    expect(await provider().suggest('No match')).toEqual([]);
  });
  it('reports malformed JSON and transport failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('invalid')));
    await expect(provider().suggest('School')).rejects.toMatchObject({
      code: 'PLACE_SEARCH_INVALID_RESPONSE',
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect(provider().suggest('School')).rejects.toMatchObject({ code: 'PLACE_SEARCH_UNAVAILABLE' });
  });
  it('does not send a request without a key', async () => {
    const fetcher = mock([]);
    await expect(new VietmapPlaceSearchProvider().suggest('School')).rejects.toMatchObject({
      code: 'PLACE_SEARCH_NOT_CONFIGURED',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('supports reverse geocoding using actual returned coordinates', async () => {
    mock([{ ref_id: 'ref', name: '197 Trần Phú', address: 'Quận 5', lat: 10.75, lng: 106.67 }]);
    expect(await provider().reverse({ lat: 10.75, lng: 106.67 })).toMatchObject({
      name: '197 Trần Phú',
      source: 'vietmap',
      lat: 10.75,
    });
  });
});

describe('VietMap place details errors', () => {
  it('maps an unknown reference (HTTP 404) to 404 PLACE_NOT_FOUND instead of "VietMap busy"', async () => {
    mock({ message: 'not found' }, 404);
    await expect(provider().resolve('auto:unknown')).rejects.toMatchObject({
      statusCode: 404,
      code: 'PLACE_NOT_FOUND',
    });
  });

  it('still treats other upstream failures as unavailable', async () => {
    mock({}, 500);
    await expect(provider().resolve('auto:x')).rejects.toMatchObject({
      statusCode: 502,
      code: 'PLACE_SEARCH_UNAVAILABLE',
    });
  });
});

describe('VietMap place search with landmark aliases', () => {
  it('"Hồ Gươm" also asks for "Hồ Hoàn Kiếm" and puts the lake first', async () => {
    const fetcher = vi.fn().mockImplementation(async (url: URL) => {
      const text = new URL(url).searchParams.get('text');
      const body =
        text === 'Hồ Hoàn Kiếm'
          ? [{ ref_id: 'lake', name: 'Hồ Hoàn Kiếm', address: 'Hoàn Kiếm, Hà Nội' }]
          : [
              { ref_id: 'mall', name: 'Trung Tâm Thương Mại Hồ Gươm Plaza', address: 'Hà Nội' },
              { ref_id: 'walk', name: 'Phố Đi Bộ Hồ Gươm', address: 'Hà Nội' },
            ];
      return new Response(JSON.stringify(body));
    });
    vi.stubGlobal('fetch', fetcher);
    const ids = (await provider().suggest('Hồ Gươm', { lat: 21.03, lng: 105.85 })).map((place) => place.id);
    expect(ids).toEqual(['lake', 'walk', 'mall']);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps the typed results when the alias lookup fails', async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(async (url: URL) =>
        new URL(url).searchParams.get('text') === 'Hồ Hoàn Kiếm'
          ? new Response('{}', { status: 500 })
          : new Response(JSON.stringify([{ ref_id: 'walk', name: 'Phố Đi Bộ Hồ Gươm', address: 'Hà Nội' }])),
      );
    vi.stubGlobal('fetch', fetcher);
    expect((await provider().suggest('ho guom')).map((place) => place.id)).toEqual(['walk']);
  });

  it('does not make an extra call for ordinary queries', async () => {
    const fetcher = mock([{ ref_id: 'pho', name: 'Phở Hòa', address: 'Quận 3' }]);
    await provider().suggest('Phở Hòa');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('VietMap address format', () => {
  it('requests the post-2025 administrative format (display_type=5) for suggestions and reverse geocoding', async () => {
    const fetcher = mock([
      { ref_id: 'a', name: 'Chợ Bến Thành', address: 'Phường Bến Thành, Thành phố Hồ Chí Minh' },
    ]);
    await provider().suggest('Chợ Bến Thành');
    expect(new URL(fetcher.mock.calls[0]![0]).searchParams.get('display_type')).toBe('5');
    mock([
      {
        ref_id: 'r',
        name: '21-23 Phan Chu Trinh',
        address: 'Phường Bến Thành,Thành phố Hồ Chí Minh',
        display: '21-23 Phan Chu Trinh Phường Bến Thành,Thành phố Hồ Chí Minh',
        lat: 10.7725,
        lng: 106.698,
      },
    ]);
    const place = await provider().reverse({ lat: 10.7725, lng: 106.698 });
    expect(place?.address).toBe('21-23 Phan Chu Trinh Phường Bến Thành, Thành phố Hồ Chí Minh');
  });
});
