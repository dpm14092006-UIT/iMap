import { type RouteStopCandidate, type StopPlace } from '@routetwin/shared';
import type { RoutePlan } from '../routing/types';
export type Point = { lat: number; lng: number };
export type PlaceAssistantPanelProps = {
  accessToken: string;
  route: RoutePlan | null;
  selectedPoint: Point | null;
  getMapCenter: () => Point;
  onClose: () => void;
  onFocus: (place: StopPlace) => void;
  onDirections: (place: StopPlace) => void;
  onAddStop: (candidate: RouteStopCandidate, routeId: string) => void;
  onRemoveStop: () => void;
};
