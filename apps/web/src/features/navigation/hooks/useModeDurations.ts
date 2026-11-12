import { useState } from 'react';
import type { TransportMode } from '../../map/types';
import type { DirectionsController } from './useDirections';

export type ModeDurations = Partial<Record<TransportMode, number>>;

/**
 * Nhớ thời gian đã tính cho từng phương tiện trên cùng cặp điểm đi/đến, để thẻ phương tiện
 * hiện "12 ph" cho cả xe máy và ô tô mà không phải gọi thêm API. Đổi điểm hoặc tùy chọn thì quên.
 */
export function useModeDurations(directions: DirectionsController): ModeDurations {
  const { origin, destination, waypoints, objective, avoidFerry, vehicle, route, routeOptions } = directions;
  const key = [
    origin?.id,
    destination?.id,
    waypoints.map((item) => item.place?.id).join(','),
    objective,
    avoidFerry,
  ].join('|');
  const [cache, setCache] = useState<{ key: string; minutes: ModeDurations }>({ key, minutes: {} });

  let current = cache.key === key ? cache : { key, minutes: {} };
  const minutes = route ? (routeOptions[0] ?? route).durationMin : undefined;
  if (minutes !== undefined && current.minutes[vehicle] !== minutes) {
    current = { key, minutes: { ...current.minutes, [vehicle]: minutes } };
  }
  // Cập nhật state ngay trong lúc render là cách React cho phép để suy ra state từ props.
  if (current !== cache) setCache(current);
  return current.minutes;
}
