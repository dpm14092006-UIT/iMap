import { useEffect, useRef } from 'react';
import type { Place } from '../../../features/places/types';
import type { RouteApiClient } from '../../../features/routing/api/RouteApiClient';
import type { RouteObjective, RoutePlan, TransportMode } from '../../../features/routing/types';
import { RequestGeneration } from '../../../shared/async/RequestGeneration';
import type { FeatureKey } from '../../types';

type Options = {
  routeApi: RouteApiClient;
  activePanel: FeatureKey | null;
  activeRoute: RoutePlan | null;
  setActiveRoute: (route: RoutePlan | null) => void;
  onPlanned: () => void;
  showToast: (message: string) => void;
  t: (text: string) => string;
};

/**
 * Hành trình nhiều điểm: tối ưu thứ tự ghé qua API và vẽ lên bản đồ.
 * Rời panel hoặc bắt đầu yêu cầu mới thì bỏ kết quả còn đang chờ, tránh vẽ đè tuyến của panel khác.
 */
export function useMultiStopPlanner(options: Options) {
  const { routeApi, activePanel, activeRoute, setActiveRoute, onPlanned, showToast, t } = options;
  const generation = useRef(new RequestGeneration());

  useEffect(() => {
    const requests = generation.current;
    return () => requests.invalidate();
  }, []);

  useEffect(() => {
    if (activePanel && activePanel !== 'multi') generation.current.invalidate();
  }, [activePanel]);

  const plan = async (
    start: Place,
    stops: Place[],
    vehicle: TransportMode,
    objective: RouteObjective,
    returnToStart: boolean,
  ): Promise<RoutePlan | { error: string }> => {
    const request = generation.current.begin();
    setActiveRoute(null);
    const result = await routeApi.createOptimizedPlan(
      [start, ...stops],
      vehicle,
      objective,
      returnToStart,
      'auto',
    );
    if (!request.isCurrent()) return { error: t('Đã hủy hành trình cũ.') };
    if ('error' in result) return result;
    setActiveRoute(result);
    onPlanned();
    showToast(t('Đã tối ưu thứ tự ghé theo đường đi VietMap'));
    return result;
  };

  const reset = (planId?: string) => {
    generation.current.invalidate();
    if (activeRoute?.id === planId) setActiveRoute(null);
  };

  return {
    plan,
    reset,
    /** Dùng chung bộ đếm cho mọi yêu cầu vẽ hành trình nhiều điểm (kể cả mở lại tuyến đã lưu). */
    beginRequest: () => generation.current.begin(),
  };
}

export type MultiStopPlanner = ReturnType<typeof useMultiStopPlanner>;
