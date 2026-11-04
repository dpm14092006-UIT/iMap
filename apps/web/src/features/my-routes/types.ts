import type { DemoPlace, RoutePlan, TransportMode } from '../map/types';

export type SavedRoute = {
  id: string;
  kind: 'route' | 'multi';
  title: string;
  origin: DemoPlace;
  destination?: DemoPlace;
  stops?: DemoPlace[];
  vehicle: TransportMode;
  plan?: RoutePlan;
  originId: string;
  originName: string;
  destinationId: string;
  destinationName: string;
};
