import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../../shared/errors/AppError.js';
import { PhotonPlaceSearchProvider } from './PhotonPlaceSearchProvider.js';

/** Giả lập fetch trả về một JSON cố định để test adapter không cần mạng. */
function mockFetchJson(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('PhotonPlaceSearchProvider', () => {
  it('suggest: đổi GeoJSON [lng,lat] sang {lat,lng} và bỏ kết quả thiếu tọa độ', async () => {
    mockFetchJson({
      features: [
        { properties: { osm_type: 'N', osm_id: 1, name: 'Chợ Bến Thành', district: 'Quận 1', city: 'Hồ Chí Minh' }, geometry: { coordinates: [106.6983, 10.7721] } },
        { properties: { name: 'Không có tọa độ' }, geometry: {} },
      ],
    });
    const result = await new PhotonPlaceSearchProvider().suggest('ben thanh');
    expect(result).toEqual([{ id: 'osm-N-1', name: 'Chợ Bến Thành', address: 'Quận 1, Hồ Chí Minh', lat: 10.7721, lng: 106.6983 }]);
  });

  it('reverse: dùng "số nhà + đường" làm tên khi không có tên POI', async () => {
    const fetchMock = mockFetchJson({
      features: [{ properties: { housenumber: '12', street: 'Lê Lợi', city: 'Hồ Chí Minh' }, geometry: { coordinates: [106.7, 10.77] } }],
    });
    const result = await new PhotonPlaceSearchProvider().reverse({ lat: 10.77, lng: 106.7 });
    expect(result?.name).toBe('12 Lê Lợi');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/reverse?lat=10.77&lon=106.7');
  });

  it('reverse: trả null khi không có địa chỉ', async () => {
    mockFetchJson({ features: [] });
    expect(await new PhotonPlaceSearchProvider().reverse({ lat: 0, lng: 0 })).toBeNull();
  });

  it('báo AppError 502 khi Photon lỗi', async () => {
    mockFetchJson({}, 500);
    await expect(new PhotonPlaceSearchProvider().suggest('abc')).rejects.toBeInstanceOf(AppError);
  });
});
