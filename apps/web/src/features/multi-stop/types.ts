import type { LatLng } from '../../shared/geo/types';
import type { Place } from '../places/types';
import type { RouteObjective, RoutePlan, TransportMode } from '../routing/types';
export type MultiStopPanelProps = {
  isActive: boolean;
  onShowPlan: (plan: RoutePlan) => void;
  onStartNavigation: (plan: RoutePlan) => void;
  isNavigating: boolean;
  getFocus?: () => LatLng;
  onReset: (planId?: string) => void;
  onClose: () => void;
  onPlanRoute: (
    start: Place,
    stops: Place[],
    mode: TransportMode,
    objective: RouteObjective,
    returnToStart: boolean,
  ) => Promise<RoutePlan | { error: string }>;
  onSave?: (plan: RoutePlan) => void;
};
export type LocalizedMessage = { source: string; values?: Record<string, string | number> };
