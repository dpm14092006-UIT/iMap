import { describe, expect, it } from 'vitest';
import type { RoutePlan } from '../../routing/types';
import type { Place } from '../../places/types';
import type { SavedRoute } from '../types';
import { savedRouteKey } from './savedRouteKey';

const place = (id: string, lat: number, lng: number): Place =>
  ({ id, name: id, address: '', category: '', lat, lng, source: 'map' }) as Place;

const A = place('A', 10.77, 106.69);
const B = place('B', 10.78, 106.7);
const C = place('C', 10.79, 106.71);

function saved(overrides: Partial<SavedRoute> & { objective?: RoutePlan['objective'] } = {}): SavedRoute {
  const { objective = 'time', ...rest } = overrides;
  const stops = rest.stops ?? [A, B];
  return {
    id: 'x',
    kind: 'route',
    title: 'A → B',
    origin: stops[0]!,
    destination: stops.at(-1),
    stops,
    vehicle: 'car',
    plan: { objective } as RoutePlan,
    originId: 'A',
    originName: 'A',
    destinationId: 'B',
    destinationName: 'B',
    ...rest,
  };
}

describe('savedRouteKey', () => {
  it('lưu lại đúng tuyến cũ thì trùng khóa (được thay bằng bản mới)', () => {
    expect(savedRouteKey(saved({ id: '1' }))).toBe(savedRouteKey(saved({ id: '2' })));
  });

  it('A→B ô tô và A→B xe máy cùng tiêu đề nhưng là hai tuyến khác nhau', () => {
    expect(savedRouteKey(saved({ vehicle: 'car' }))).not.toBe(
      savedRouteKey(saved({ vehicle: 'motorcycle' })),
    );
  });

  it('khác tiêu chí (nhanh nhất / ngắn nhất) thì khác khóa', () => {
    expect(savedRouteKey(saved({ objective: 'time' }))).not.toBe(
      savedRouteKey(saved({ objective: 'distance' })),
    );
  });

  it('bật "tránh phà" thì là tuyến khác', () => {
    expect(savedRouteKey(saved({ avoidFerry: true }))).not.toBe(savedRouteKey(saved({ avoidFerry: false })));
  });

  it('hai hành trình nhiều điểm cùng điểm xuất phát, cùng số điểm nhưng khác điểm ghé thì khác khóa', () => {
    const first = saved({ kind: 'multi', stops: [A, B, C] });
    const second = saved({ kind: 'multi', stops: [A, C, B] });
    expect(savedRouteKey(first)).not.toBe(savedRouteKey(second));
  });

  it('tuyến cũ chưa có danh sách stops vẫn tạo được khóa từ điểm đi/đến', () => {
    expect(savedRouteKey(saved({ stops: undefined }))).toBe(savedRouteKey(saved()));
  });
});
