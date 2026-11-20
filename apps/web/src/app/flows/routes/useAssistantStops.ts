import type { Dispatch, SetStateAction } from 'react';
import type { RouteStopCandidate } from '@routetwin/shared';
import { routePlanFromResult, type RouteApiClient } from '../../../features/routing/api/RouteApiClient';
import type { RoutePlan } from '../../../features/routing/types';
import { placeFromStop } from '../../../features/place-assistant/domain/stopPlace';

type Options = {
  activeRoute: RoutePlan | null;
  setActiveRoute: Dispatch<SetStateAction<RoutePlan | null>>;
  routeApi: RouteApiClient;
  showToast: (message: string) => void;
  t: (text: string, values?: Record<string, string | number>) => string;
};

/**
 * Trợ lý địa điểm thêm/bỏ một điểm ghé vào tuyến hai điểm đang hiển thị.
 * Kết quả chỉ được áp nếu tuyến trên bản đồ vẫn là tuyến lúc bắt đầu.
 */
export function useAssistantStops({ activeRoute, setActiveRoute, routeApi, showToast, t }: Options) {
  const replaceIfUnchanged = (originalId: string, plan: RoutePlan) =>
    setActiveRoute((current) => (current?.id === originalId ? plan : current));

  const add = async (candidate: RouteStopCandidate, expectedRouteId: string) => {
    if (!activeRoute || activeRoute.id !== expectedRouteId || activeRoute.stops.length !== 2) {
      showToast(t('Tuyến đã thay đổi. Hãy tìm lại điểm dừng.'));
      return;
    }
    const stop = placeFromStop(candidate.place);
    const stops = [activeRoute.stops[0]!, stop, activeRoute.stops[1]!];
    const { id: originalId, vehicle, objective } = activeRoute;
    // Trợ lý luôn tính tuyến qua điểm ghé theo "nhanh nhất". Tuyến đang theo "ngắn nhất" thì tính lại
    // đúng tiêu chí đó, thay vì dùng tuyến của trợ lý rồi gắn nhầm nhãn.
    let plan: RoutePlan;
    if (objective === 'time') {
      plan = routePlanFromResult(candidate.route, stops, vehicle, objective);
    } else {
      const result = await routeApi.createPlan(stops, vehicle, objective);
      if ('error' in result) {
        showToast(t(result.error));
        return;
      }
      plan = result;
    }
    replaceIfUnchanged(originalId, plan);
    showToast(t('Đã thêm điểm ghé: {name}', { name: stop.name }));
  };

  const remove = async () => {
    if (!activeRoute || activeRoute.stops.length < 3) return;
    const result = await routeApi.createPlan(
      [activeRoute.stops[0]!, activeRoute.stops[activeRoute.stops.length - 1]!],
      activeRoute.vehicle,
      activeRoute.objective,
    );
    if ('error' in result) {
      showToast(t(result.error));
      return;
    }
    replaceIfUnchanged(activeRoute.id, result);
  };

  return { add, remove };
}
