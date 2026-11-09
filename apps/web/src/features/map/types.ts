import type { RouteInstruction } from '@routetwin/shared';

export type DemoPlace = {
  id: string;
  name: string;
  district: string;
  category: string;
  lat: number;
  lng: number;
  source?: 'demo' | 'Photon / OpenStreetMap';
};

export type FeatureKey = 'directions' | 'multi' | 'traffic' | 'saved' | 'place' | 'assistant';
export type MapLayer = 'street' | 'satellite' | 'dark';
export type TransportMode = 'car' | 'motorcycle';
export type RouteObjective = 'time' | 'distance';
export type Coordinate = [number, number];

export type RouteLeg = {
  nodes: string[];
  points: Coordinate[];
  distanceKm: number;
  durationMin: number;
  from: DemoPlace;
  to: DemoPlace;
  instructions?: RouteInstruction[];
};

export type RoutePlan = {
  id: string;
  kind: 'route' | 'multi';
  stops: DemoPlace[];
  legs: RouteLeg[];
  distanceKm: number;
  durationMin: number;
  vehicle: TransportMode;
  objective: RouteObjective;
};

export type MapIncident = {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  time: string;
  lat: number;
  lng: number;
  communityReportCount?: number;
  communityReporterCount?: number;
  communityUpdatedAt?: string;
};
