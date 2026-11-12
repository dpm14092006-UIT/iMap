import { afterEach, describe, expect, it, vi } from 'vitest';
import { VietmapPoiSearchProvider } from './VietmapPoiSearchProvider.js';

afterEach(() => vi.unstubAllGlobals());
const provider = () => new VietmapPoiSearchProvider('test-key');
function mock(...bodies: unknown[]) {
  const fetcher = vi.fn();
  for (const body of bodies)
    fetcher.mockImplementationOnce(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
const request = {
  text: 'xăng',
  center: { lat: 10.8, lng: 106.75 },
  radiusM: 1500,
  categoryCodes: ['10009'],
};

describe('VietmapPoiSearchProvider', () => {
  it('gửi đúng tham số autocomplete và đổi distance km sang mét', async () => {
    const fetcher = mock([
      { ref_id: 'auto:x', name: 'Cây Xăng A', address: 'Quận 9', distance: 0.65, categories: ['10009'] },
    ]);
    expect(await provider().search(request)).toEqual([
      { id: 'auto:x', name: 'Cây Xăng A', address: 'Quận 9', categoryCodes: ['10009'], distanceM: 650 },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = new URL(fetcher.mock.calls[0]![0]);
    expect(url.pathname).toBe('/api/autocomplete/v4');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      text: 'xăng',
      focus: '10.8,106.75',
      circle_center: '10.8,106.75',
      circle_radius: '1500',
      cats: '10009',
      layers: 'POI',
      display_type: '6',
    });
  });

  it('không gửi cats khi danh mục không có mã', async () => {
    const fetcher = mock([{ ref_id: 'a', name: 'Sửa Xe B', address: '' }]);
    await provider().search({ ...request, categoryCodes: [] });
    expect(new URL(fetcher.mock.calls[0]![0]).searchParams.has('cats')).toBe(false);
  });

  it('không gọi Search v4 khi autocomplete rỗng (tránh giao dịch tính phí thứ hai)', async () => {
    const fetcher = mock([], [{ ref_id: 'b', name: 'Quán B', address: 'Q1' }]);
    expect(await provider().search(request)).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(new URL(fetcher.mock.calls[0]![0]).pathname).toBe('/api/autocomplete/v4');
  });

  it('lấy toạ độ bằng Place v4 theo refid', async () => {
    const fetcher = mock({ name: 'Cây Xăng A', display: 'Cây Xăng A, Quận 9', lat: 10.81, lng: 106.76 });
    expect(await provider().locate('auto:a+b/==')).toMatchObject({
      lat: 10.81,
      lng: 106.76,
      address: 'Quận 9',
    });
    const url = new URL(fetcher.mock.calls[0]![0]);
    expect(url.pathname).toBe('/api/place/v4');
    expect(url.searchParams.get('refid')).toBe('auto:a+b/==');
  });

  it('từ chối toạ độ không hợp lệ và phản hồi sai định dạng', async () => {
    mock({ name: 'X', lat: 999, lng: 106 });
    await expect(provider().locate('r')).rejects.toMatchObject({ code: 'PLACE_SEARCH_INVALID_RESPONSE' });
    mock({ not: 'an array' });
    await expect(provider().search(request)).rejects.toMatchObject({ code: 'PLACE_SEARCH_INVALID_RESPONSE' });
  });

  it.each([
    [401, 'PLACE_SEARCH_AUTH'],
    [429, 'PLACE_SEARCH_QUOTA'],
    [500, 'PLACE_SEARCH_UNAVAILABLE'],
  ])('ánh xạ HTTP %s sang %s và không lộ key', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));
    const error = await provider()
      .search(request)
      .catch((cause: unknown) => cause as Error);
    expect(error).toMatchObject({ code });
    expect(String((error as Error).message)).not.toContain('test-key');
  });

  it('báo chưa cấu hình khi thiếu key, không gọi mạng', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(new VietmapPoiSearchProvider().search(request)).rejects.toMatchObject({
      code: 'PLACE_SEARCH_NOT_CONFIGURED',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('lỗi mạng thành PLACE_SEARCH_UNAVAILABLE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(provider().search(request)).rejects.toMatchObject({ code: 'PLACE_SEARCH_UNAVAILABLE' });
  });
});
