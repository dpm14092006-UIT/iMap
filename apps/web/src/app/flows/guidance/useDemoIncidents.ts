import { useEffect, useState } from 'react';
import type { RouteIncident } from '../../../features/guidance/domain/IncidentAheadDetector';
import type { RoutePath } from '../../../features/guidance/domain/RoutePath';

/** Sự cố giả đặt phía trước xe bao xa (mét), và giữ cách cuối tuyến tối thiểu bao xa. */
const DEMO_INCIDENT_AHEAD_METERS = 600;
const DEMO_INCIDENT_END_MARGIN_METERS = 50;

type Options = {
  navigationPath: RoutePath | null;
  /** Tiến độ chuyến đi (0..1). */
  progressRatio: number;
  isNavigationIdle: boolean;
};

/**
 * Sự cố giả của chế độ Demo: chỉ nằm trên máy này, vẽ chung với sự cố thật để thấy tuyến mới né chỗ nào.
 * Kết thúc chuyến thì xóa hết.
 */
export function useDemoIncidents({ navigationPath, progressRatio, isNavigationIdle }: Options) {
  const [demoIncidents, setDemoIncidents] = useState<RouteIncident[]>([]);

  useEffect(() => {
    if (isNavigationIdle) setDemoIncidents([]);
  }, [isNavigationIdle]);

  /** Đặt một "đường đóng" giả phía trước xe để xem app tự né. */
  const addAhead = () => {
    if (!navigationPath) return;
    const progressMeters = progressRatio * navigationPath.totalMeters;
    const point = navigationPath.pointAt(
      Math.min(
        navigationPath.totalMeters - DEMO_INCIDENT_END_MARGIN_METERS,
        progressMeters + DEMO_INCIDENT_AHEAD_METERS,
      ),
    );
    setDemoIncidents((current) => [
      ...current,
      { id: `demo-${Date.now()}`, title: 'Đường đóng (demo)', ...point },
    ]);
  };

  return { demoIncidents, addAhead };
}
