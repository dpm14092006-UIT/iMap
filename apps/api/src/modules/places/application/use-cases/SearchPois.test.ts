import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AlongRoutePoiRequest, NearbyPoiRequest } from '@routetwin/shared';
import { AppError } from '../../../../shared/errors/AppError.js';
import type { PoiCandidate, PoiLocation, PoiSearchRequest } from '../ports/PoiSearchProvider.js';
import { SearchPoisAlongRouteUseCase } from './SearchPoisAlongRouteUseCase.js';
import { SearchPoisNearbyUseCase } from './SearchPoisNearbyUseCase.js';

afterEach(() => vi.restoreAllMocks());

const candidate = (
  id: string,
  name: string,
  distanceM = 100,
  extra: Partial<PoiCandidate> = {},
): PoiCandidate => ({
  id,
  name,
  address: `Địa chỉ ${id}`,
  categoryCodes: [],
  distanceM,
  ...extra,
});

function fakeProvider(
  search: (request: PoiSearchRequest) => PoiCandidate[] | Promise<PoiCandidate[]>,
  locate: (id: string) => PoiLocation | Promise<PoiLocation> = (id) => ({
    id,
    name: id,
    address: '',
    lat: 10.75,
    lng: 106.7005,
  }),
) {
  return {
    search: vi.fn(async (request: PoiSearchRequest) => search(request)),
    locate: vi.fn(async (id: string) => locate(id)),
  };
}

/** Tuyến thẳng ~11 km hướng bắc, dọc kinh tuyến 106,7. */
const path: AlongRoutePoiRequest['path'] = [
  [10.7, 106.7],
  [10.8, 106.7],
];
const along = (overrides: Partial<AlongRoutePoiRequest> = {}): AlongRoutePoiRequest => ({
  path,
  query: 'phở',
  radiusM: 1500,
  limit: 15,
  ...overrides,
});

describe('SearchPoisAlongRouteUseCase', () => {
  it('tìm tại các điểm mẫu với đúng từ khóa, tâm và bán kính', async () => {
    const provider = fakeProvider(() => []);
    expect(await new SearchPoisAlongRouteUseCase(provider).execute(along())).toEqual([]);
    expect(provider.search).toHaveBeenCalledTimes(6); // 11,1 km / 2,4 km -> 5 khoảng, 6 điểm
    const first = provider.search.mock.calls[0]![0];
    expect(first).toMatchObject({ text: 'phở', radiusM: 1500, categoryCodes: [] });
    expect(first.center).toEqual({ lat: 10.7, lng: 106.7 });
    expect(provider.locate).not.toHaveBeenCalled();
  });

  it('dùng từ khóa và mã của danh mục khi có category', async () => {
    const provider = fakeProvider(() => []);
    await new SearchPoisAlongRouteUseCase(provider).execute(along({ query: undefined, category: 'fuel' }));
    expect(provider.search.mock.calls[0]![0]).toMatchObject({ text: 'xăng', categoryCodes: ['10009'] });
  });

  it('khử trùng theo ref_id và theo tên+địa chỉ đã chuẩn hóa, chỉ lấy toạ độ cho bản duy nhất', async () => {
    const provider = fakeProvider(() => [
      candidate('a', 'Phở Hòa'),
      candidate('a', 'Phở Hòa'),
      { ...candidate('b', 'PHO HOA'), address: 'ĐỊA CHỈ a' }, // cùng tên + địa chỉ sau chuẩn hóa
    ]);
    const result = await new SearchPoisAlongRouteUseCase(provider).execute(along());
    expect(result.map((poi) => poi.id)).toEqual(['a']);
    expect(provider.locate).toHaveBeenCalledTimes(1);
  });

  it('chỉ gọi Place v4 tối đa `limit` lần và phủ nhiều đoạn dọc tuyến', async () => {
    const group = (id: string) => Number(id.split('-')[0]!.slice(1));
    const provider = fakeProvider(
      ({ center }) =>
        Array.from({ length: 10 }, (_, i) => {
          const k = Math.round((center.lat - 10.7) * 100);
          return candidate(`p${k}-${i}`, `Phở ${k}-${i}`, 100 + i);
        }),
      (id) => ({ id, name: id, address: '', lat: 10.7 + group(id) * 0.01, lng: 106.7 }),
    );
    const result = await new SearchPoisAlongRouteUseCase(provider).execute(along({ limit: 12 }));
    expect(provider.locate).toHaveBeenCalledTimes(12);
    expect(new Set(result.map((poi) => group(poi.id))).size).toBe(6); // đủ 6 điểm mẫu, không dồn ở đầu tuyến
  });

  it('tính khoảng cách tới tuyến, vị trí dọc tuyến, thời gian đi vòng; loại điểm xa hơn bán kính', async () => {
    const provider = fakeProvider(
      () => [candidate('near', 'Phở Gần'), candidate('far', 'Phở Xa'), candidate('mid', 'Phở Giữa')],
      (id) =>
        ({
          // 0,005 độ kinh ≈ 548 m; 0,05 độ ≈ 5,5 km
          near: { id, name: id, address: '', lat: 10.72, lng: 106.705 },
          far: { id, name: id, address: '', lat: 10.72, lng: 106.75 },
          mid: { id, name: id, address: '', lat: 10.78, lng: 106.7 },
        })[id]!,
    );
    const result = await new SearchPoisAlongRouteUseCase(provider).execute(along());
    expect(result.map((poi) => poi.id)).toEqual(['near', 'mid']); // theo vị trí dọc tuyến
    expect(result[0]!.distanceFromRouteM).toBeGreaterThan(500);
    expect(result[0]!.distanceFromRouteM).toBeLessThan(600);
    expect(result[0]!.positionAlongRouteM).toBeCloseTo(2224, -2);
    expect(result[0]!.detourMin).toBe(3);
    expect(result[1]!.detourMin).toBe(0);
  });

  it('khử trùng lần hai theo toạ độ khi cùng tên cách nhau < 30 m', async () => {
    const provider = fakeProvider(
      () => [candidate('a', 'Phở Highlands'), { ...candidate('b', 'Phở Highlands'), address: 'Khác' }],
      (id) => ({ id, name: id, address: '', lat: 10.75, lng: id === 'a' ? 106.7001 : 106.70015 }),
    );
    const result = await new SearchPoisAlongRouteUseCase(provider).execute(along());
    expect(result).toHaveLength(1);
  });

  it('gán danh mục từ gợi ý hoặc từ mã VietMap; null với từ khóa tự do', async () => {
    const provider = fakeProvider(() => [
      candidate('a', 'Trạm xe A', 100, { categoryCodes: ['10009'] }),
      candidate('b', 'Tiệm xe B', 100, { categoryCodes: ['10002'] }),
    ]);
    const result = await new SearchPoisAlongRouteUseCase(provider).execute(along({ query: 'xe' }));
    expect(result.find((poi) => poi.id === 'a')!.category).toBe('fuel');
    expect(result.find((poi) => poi.id === 'b')!.category).toBeNull();
    const withHint = await new SearchPoisAlongRouteUseCase(provider).execute(
      along({ query: undefined, category: 'fuel' }),
    );
    expect(withHint.every((poi) => poi.category === 'fuel')).toBe(true);
  });

  it('bỏ kết quả lỗi toạ độ nhưng giữ phần còn lại', async () => {
    const provider = fakeProvider(
      () => [candidate('bad', 'Phở Hỏng'), candidate('ok', 'Phở Tốt')],
      (id) => {
        if (id === 'bad') throw new AppError(502, 'PLACE_SEARCH_INVALID_RESPONSE', 'x');
        return { id, name: id, address: '', lat: 10.75, lng: 106.7 };
      },
    );
    const result = await new SearchPoisAlongRouteUseCase(provider).execute(along());
    expect(result.map((poi) => poi.id)).toEqual(['ok']);
  });

  it('một số điểm mẫu lỗi thì dùng phần còn lại; tất cả lỗi thì ném lỗi nhà cung cấp', async () => {
    let n = 0;
    const partial = fakeProvider(() => {
      if (n++ % 2 === 0) throw new AppError(502, 'PLACE_SEARCH_UNAVAILABLE', 'bận');
      return [candidate('a', 'Phở')];
    });
    expect(await new SearchPoisAlongRouteUseCase(partial).execute(along())).toHaveLength(1);

    const failing = fakeProvider(() => {
      throw new AppError(429, 'PLACE_SEARCH_QUOTA', 'hết hạn mức');
    });
    await expect(new SearchPoisAlongRouteUseCase(failing).execute(along())).rejects.toMatchObject({
      code: 'PLACE_SEARCH_QUOTA',
    });
  });

  it('tất cả lần lấy toạ độ lỗi thì ném lỗi thay vì trả rỗng', async () => {
    const provider = fakeProvider(
      () => [candidate('a', 'Phở')],
      () => {
        throw new AppError(429, 'PLACE_SEARCH_QUOTA', 'hết hạn mức');
      },
    );
    await expect(new SearchPoisAlongRouteUseCase(provider).execute(along())).rejects.toMatchObject({
      code: 'PLACE_SEARCH_QUOTA',
    });
  });

  it('không có tối đa quá 4 tìm kiếm cùng lúc', async () => {
    let active = 0;
    let peak = 0;
    const provider = fakeProvider(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return [];
    });
    await new SearchPoisAlongRouteUseCase(provider).execute(
      along({
        path: [
          [10, 106],
          [11, 106],
        ],
      }),
    );
    expect(provider.search).toHaveBeenCalledTimes(8); // 111 km: trần 8 điểm mẫu (chưa có trần sẽ là 11)
    expect(peak).toBe(4);
  });
});

describe('lọc độ liên quan theo tên (truy vấn tự do)', () => {
  const names = ['Phở Gà Phố Cổ', 'Kim Kê Phở', 'The American School', 'Cafe Phố Mới'];
  const provider = (list = names) =>
    fakeProvider(() => list.map((name, i) => ({ ...candidate(`id${i}`, name), address: 'Khu Phố 3' })));

  it('"phở" giữ tên có phở, bỏ "The American School" (địa chỉ Khu Phố 3) và "Cafe Phố Mới", không gọi Place v4 cho chúng', async () => {
    const fake = provider();
    const result = await new SearchPoisAlongRouteUseCase(fake).execute(along({ query: 'phở' }));
    expect(result.map((poi) => poi.id).sort()).toEqual(['id0', 'id1']);
    expect(fake.locate.mock.calls.map(([id]) => id).sort()).toEqual(['id0', 'id1']);
  });

  it('"pho" không dấu giữ cả tên phở và phố', async () => {
    const fake = provider();
    const result = await new SearchPoisAlongRouteUseCase(fake).execute(along({ query: 'pho' }));
    expect(result.map((poi) => poi.id).sort()).toEqual(['id0', 'id1', 'id3']);
  });

  it('nhiều từ "cà phê muối" yêu cầu đủ mọi từ trong tên', async () => {
    const fake = provider(['Cà Phê Muối Chú Long', 'Cà Phê Sữa', 'Muối Ớt']);
    const result = await new SearchPoisAlongRouteUseCase(fake).execute(along({ query: 'cà phê muối' }));
    expect(result.map((poi) => poi.id)).toEqual(['id0']);
  });

  it('tìm theo danh mục không bị lọc tên', async () => {
    const fake = provider(['Trạm Petrolimex', 'Cây xăng 24']);
    const result = await new SearchPoisAlongRouteUseCase(fake).execute(
      along({ query: undefined, category: 'fuel' }),
    );
    expect(result.map((poi) => poi.id).sort()).toEqual(['id0', 'id1']);
  });

  it('cũng áp dụng cho tìm quanh đây', async () => {
    const fake = fakeProvider(
      () => [candidate('a', 'Phở Lý Quốc Sư'), candidate('b', 'Cafe Phố Mới')],
      (id) => ({ id, name: id, address: '', lat: 10.8, lng: 106.75 }),
    );
    const result = await new SearchPoisNearbyUseCase(fake).execute({
      lat: 10.8,
      lng: 106.75,
      query: 'phở',
      radiusM: 1000,
      limit: 15,
    });
    expect(result.map((poi) => poi.id)).toEqual(['a']);
  });
});

describe('SearchPoisNearbyUseCase', () => {
  const nearby = (overrides: Partial<NearbyPoiRequest> = {}): NearbyPoiRequest => ({
    lat: 10.8,
    lng: 106.75,
    query: 'sửa xe',
    radiusM: 1000,
    limit: 15,
    ...overrides,
  });

  it('một lần tìm tại tâm, xếp theo khoảng cách và lọc theo bán kính', async () => {
    const provider = fakeProvider(
      () => [candidate('far', 'Sửa xe Xa'), candidate('near', 'Sửa xe Gần')],
      (id) => ({ id, name: id, address: '', lat: id === 'near' ? 10.802 : 10.82, lng: 106.75 }),
    );
    const result = await new SearchPoisNearbyUseCase(provider).execute(nearby());
    expect(provider.search).toHaveBeenCalledTimes(1);
    expect(provider.search.mock.calls[0]![0]).toMatchObject({
      text: 'sửa xe',
      center: { lat: 10.8, lng: 106.75 },
      radiusM: 1000,
    });
    expect(result.map((poi) => poi.id)).toEqual(['near']);
    expect(result[0]).toMatchObject({ distanceFromRouteM: 0, detourMin: 0 });
    expect(result[0]!.distanceFromCenterM).toBeGreaterThan(200);
    expect(result[0]!.distanceFromCenterM).toBeLessThan(240);
  });
});
