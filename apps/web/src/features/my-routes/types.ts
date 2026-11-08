import type { RoutePlan, TransportMode } from '../map/types';
import type { Place } from '../places/types';

export type SavedRoute = {
  id: string;
  kind: 'route' | 'multi';
  title: string;
  origin: Place;
  destination?: Place;
  stops?: Place[];
  vehicle: TransportMode;
  plan?: RoutePlan;
  originId: string;
  originName: string;
  destinationId: string;
  destinationName: string;
};
