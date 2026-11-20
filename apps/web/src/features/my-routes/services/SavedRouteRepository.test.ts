import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoutePlan } from '../../routing/types';
import type { SavedRoute } from '../types';
import { LocalStorageSavedRouteRepository } from './SavedRouteRepository';

/** localStorage giả trong bộ nhớ; `quota` là số ký tự tối đa, vượt thì ném lỗi như trình duyệt thật. */
function fakeStorage(quota = Number.POSITIVE_INFINITY) {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (value.length > quota) throw new DOMException('quota', 'QuotaExceededError');
      data.set(key, value);
    },
  };
}

const route = (overrides: Partial<SavedRoute> = {}): SavedRoute => ({
  id: '1',
  kind: 'route',
  title: 'A → B',
  origin: { id: 'A', name: 'A', lat: 10, lng: 106 } as SavedRoute['origin'],
  vehicle: 'car',
  objective: 'distance',
  originId: 'A',
  originName: 'A',
  destinationId: 'B',
  destinationName: 'B',
  ...overrides,
});

afterEach(() => vi.unstubAllGlobals());

describe('LocalStorageSavedRouteRepository', () => {
  it('lưu được thì trả về true và đọc lại đúng', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    const repository = new LocalStorageSavedRouteRepository();
    expect(repository.save([route()])).toBe(true);
    expect(repository.load()).toEqual([route()]);
  });

  it('bộ nhớ đầy thì trả về false thay vì im lặng', () => {
    vi.stubGlobal('localStorage', fakeStorage(10));
    expect(new LocalStorageSavedRouteRepository().save([route()])).toBe(false);
  });

  it('dữ liệu cũ kèm cả tuyến: chỉ giữ tiêu chí, bỏ phần hình học nặng', () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    const legacy = route({
      objective: undefined,
      plan: { objective: 'distance', legs: [] } as unknown as RoutePlan,
    });
    storage.setItem('routetwin-saved-routes-v2', JSON.stringify([legacy]));
    const [loaded] = new LocalStorageSavedRouteRepository().load();
    expect(loaded?.plan).toBeUndefined();
    expect(loaded?.objective).toBe('distance');
  });
});
