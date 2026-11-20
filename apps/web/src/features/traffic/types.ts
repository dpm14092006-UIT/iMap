import type { TrafficVehicleScope } from '@routetwin/shared';

export type { TrafficVehicleScope };

export type IncidentKind =
  'traffic_jam' | 'accident' | 'construction' | 'flood' | 'road_closure' | 'obstacle';
export type IncidentSeverity = 'low' | 'medium' | 'high';

/** Sự cố đã chuẩn hoá để hiển thị trong panel giao thông và trên bản đồ. */
export type DemoIncident = {
  id: string;
  type: IncidentKind;
  severity: IncidentSeverity;
  vehicleScope: TrafficVehicleScope;
  description: string;
  time: string;
  lat: number;
  lng: number;
  imagePath?: string;
  status?: 'active' | 'cleared' | 'expired';
  communityReportCount?: number;
  communityReporterCount?: number;
  communityUpdatedAt?: string;
};
