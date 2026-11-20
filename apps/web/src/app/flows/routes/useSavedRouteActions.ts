import type { useSavedRoutes, SaveRouteOptions } from '../../../features/my-routes/hooks/useSavedRoutes';
import {
  savedRouteDirectionsQuery,
  savedRouteStops,
} from '../../../features/my-routes/domain/savedRouteQuery';
import type { SavedRoute } from '../../../features/my-routes/types';
import type { RouteApiClient } from '../../../features/routing/api/RouteApiClient';
import type { DirectionsController } from '../../../features/routing/hooks/useDirections';
import type { RoutePlan } from '../../../features/routing/types';
import type { FeatureKey } from '../../types';
import type { MultiStopPlanner } from './useMultiStopPlanner';

type Options = {
  savedRoutes: ReturnType<typeof useSavedRoutes>;
  directions: DirectionsController;
  multiStop: MultiStopPlanner;
  routeApi: RouteApiClient;
  setActiveRoute: (route: RoutePlan | null) => void;
  openPanel: (key: FeatureKey | null) => void;
  showToast: (message: string) => void;
  t: (text: string) => string;
};

/** Lưu, xóa và mở lại tuyến đã lưu (tính lại bằng VietMap, giữ điểm ghé và tùy chọn như lúc lưu). */
export function useSavedRouteActions(options: Options) {
  const { savedRoutes, directions, multiStop, routeApi, setActiveRoute, openPanel, showToast, t } = options;

  const save = (plan: RoutePlan, saveOptions?: SaveRouteOptions) => {
    // save() trả về false khi trình duyệt chặn hoặc hết bộ nhớ: báo thật, không báo "đã lưu".
    showToast(
      savedRoutes.save(plan, saveOptions)
        ? t('Đã lưu hành trình trên thiết bị này')
        : t('Không lưu được: bộ nhớ trình duyệt đầy hoặc bị chặn. Hành trình sẽ mất khi tải lại trang.'),
    );
  };

  const remove = (id: string) => {
    savedRoutes.remove(id);
    showToast(t('Đã xóa hành trình đã lưu'));
  };

  const open = async (saved: SavedRoute) => {
    const stops = savedRouteStops(saved);
    if (stops.length < 2) {
      showToast(t('Không thể mở lại hành trình này.'));
      return;
    }

    // Tuyến chỉ đường: mở trong panel để xem chỉ dẫn và đổi xe được.
    const query = saved.kind === 'route' ? savedRouteDirectionsQuery(saved) : null;
    if (query) {
      openPanel('directions');
      if (await directions.open(query)) showToast(t('Đã tính lại tuyến đã lưu bằng VietMap'));
      return;
    }

    // Tuyến nhiều điểm: tính lại và chỉ hiển thị trên bản đồ. Dùng chung bộ đếm với panel nhiều điểm:
    // mở tuyến khác, sang panel khác hay lập hành trình mới trong lúc chờ thì bỏ kết quả này.
    const request = multiStop.beginRequest();
    setActiveRoute(null);
    const result = await routeApi.createPlan(stops, saved.vehicle, saved.objective ?? 'time');
    if (!request.isCurrent()) return;
    if ('error' in result) {
      showToast(t(result.error));
      return;
    }
    setActiveRoute(result);
    openPanel(null);
    showToast(t('Đã tính lại hành trình đã lưu bằng VietMap'));
  };

  return { save, remove, open };
}
