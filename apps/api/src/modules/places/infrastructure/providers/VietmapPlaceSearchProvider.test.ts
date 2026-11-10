import { afterEach, describe, expect, it, vi } from 'vitest';
import { VietmapPlaceSearchProvider } from './VietmapPlaceSearchProvider.js';
afterEach(() => vi.unstubAllGlobals());
const provider = () => new VietmapPlaceSearchProvider('test-key');
function mock(body: unknown, status = 200) {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetcher); return fetcher;
}
describe('VietMap place search', () => {
  it('keeps suggestions without inventing coordinates; sends focus and preserves opaque reference', async () => {
    const fetcher = mock([{ ref_id: 'auto:a+b/==', name: 'THPT Trường Chinh', address: 'Quận 12', display: 'THPT Trường Chinh, Quận 12' }]);
    expect(await provider().suggest('THPT Truong Chinh', { lat: 10.85, lng: 106.63 })).toEqual([{ id: 'auto:a+b/==', name: 'THPT Trường Chinh', address: 'Quận 12', source: 'vietmap' }]);
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
    expect((await provider().suggest('Cau Rong Da Nang')).map((place) => place.id)).toEqual(['bridge', 'bridge-entrance', 'shop']);
  });
  it('resolves only the selected opaque ref with URL encoding', async () => {
    const fetcher = mock({ name: '', address: 'Đường DN11', display: 'Đường DN11, Quận 12', lat: 10.85, lng: 106.63 });
    expect(await provider().resolve('auto:a+b/==')).toMatchObject({ id: 'auto:a+b/==', lat: 10.85, lng: 106.63 });
    expect(new URL(fetcher.mock.calls[0]![0]).searchParams.get('refid')).toBe('auto:a+b/==');
  });
  it('rejects missing or invalid coordinates instead of selecting a fake point', async () => {
    mock({ name: 'School', lat: 999, lng: 106 });
    await expect(provider().resolve('ref')).rejects.toMatchObject({ code: 'PLACE_SEARCH_INVALID_RESPONSE' });
  });
  it.each([[403, 'PLACE_SEARCH_AUTH'], [429, 'PLACE_SEARCH_QUOTA'], [423, 'PLACE_SEARCH_QUOTA']])('reports provider status %s without exposing key', async (status, code) => {
    mock({}, Number(status)); await expect(provider().suggest('School')).rejects.toMatchObject({ code });
  });
  it('returns no suggestions for empty results', async () => { mock([]); expect(await provider().suggest('No match')).toEqual([]); });
  it('reports malformed JSON and transport failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('invalid')));
    await expect(provider().suggest('School')).rejects.toMatchObject({ code: 'PLACE_SEARCH_INVALID_RESPONSE' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect(provider().suggest('School')).rejects.toMatchObject({ code: 'PLACE_SEARCH_UNAVAILABLE' });
  });
  it('does not send a request without a key', async () => {
    const fetcher = mock([]);
    await expect(new VietmapPlaceSearchProvider().suggest('School')).rejects.toMatchObject({ code: 'PLACE_SEARCH_NOT_CONFIGURED' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('supports reverse geocoding using actual returned coordinates', async () => {
    mock([{ ref_id: 'ref', name: '197 Trần Phú', address: 'Quận 5', lat: 10.75, lng: 106.67 }]);
    expect(await provider().reverse({ lat: 10.75, lng: 106.67 })).toMatchObject({ name: '197 Trần Phú', source: 'vietmap', lat: 10.75 });
  });
});
