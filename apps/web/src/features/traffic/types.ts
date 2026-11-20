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

export type TrafficReportPanelProps = {
  incidents: DemoIncident[];
  selectedPoint: { lat: number; lng: number } | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  defaultVehicle: Exclude<TrafficVehicleScope, 'both'>;
  loading: boolean;
  error: string;
  onClose: () => void;
  onSignIn: () => void;
  onReport: (
    type: IncidentKind,
    severity: IncidentSeverity,
    vehicleScope: TrafficVehicleScope,
    point: { lat: number; lng: number },
    note: string,
    photo: File | null,
  ) => Promise<void>;
  onClearance: (id: string, state: 'clear' | 'still_active') => Promise<void>;
};
