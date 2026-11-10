import { afterEach, describe, expect, it, vi } from 'vitest';
import { placeApi } from './placeApi';
const suggestion = { id: 'auto:a+b/==', name: 'THPT Trường Chinh', address: 'Quận 12', source: 'vietmap' as const, category: 'Địa chỉ' };
afterEach(() => vi.unstubAllGlobals());
describe('place selection', () => {
  it('keeps autocomplete entries without coordinates, without requesting details prematurely', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [suggestion] })));
    vi.stubGlobal('fetch', fetcher);
    const result = await placeApi.suggest('Truong Chinh', { lat: 10.85, lng: 106.63 });
    expect(result).toHaveLength(1); expect(result[0]!.lat).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]![0])).toContain('/places/suggest?');
  });
  it('resolves the selected reference once and retains the POI name', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: suggestion.id, name: 'DN11', address: 'DN11, Quận 12', lat: 10.84, lng: 106.62 } })));
    vi.stubGlobal('fetch', fetcher);
    expect(await placeApi.resolve(suggestion)).toMatchObject({ name: 'THPT Trường Chinh', lat: 10.84, lng: 106.62 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]![0])).toContain(encodeURIComponent(suggestion.id));
  });
  it('uses existing local coordinates without a provider call', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect(await placeApi.resolve({ ...suggestion, lat: 10.84, lng: 106.62 })).toMatchObject({ lat: 10.84 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not turn missing detail coordinates into a selectable point', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: suggestion.id } }))));
    await expect(placeApi.resolve(suggestion)).rejects.toThrow('tọa độ');
  });
});
