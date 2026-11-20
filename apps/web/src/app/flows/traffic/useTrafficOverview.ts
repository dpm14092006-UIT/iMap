import { useMemo } from 'react';
import type { TrafficReportDto } from '@routetwin/shared';
import type { TransportMode } from '../../../features/routing/types';
import {
  avoidableIncidents,
  mergeDemoIncidents,
  reportsForVehicle,
  translateLayerTitles,
  type AvoidableIncident,
} from '../../../features/traffic/domain/trafficOverview';
import { toIncidents, toReportsMapLayer } from '../../../features/traffic/domain/trafficPresentation';

type Options = {
  reports: TrafficReportDto[];
  /** Loại xe đang xem: chỉ hiện sự cố áp dụng cho xe này. */
  vehicle: TransportMode;
  demoIncidents: AvoidableIncident[];
  t: (text: string) => string;
};

/**
 * Bức tranh giao thông dùng chung cho bản đồ, panel và dẫn đường (xem `buildTrafficOverview`);
 * mỗi bước được nhớ riêng để chỉ tính lại phần có đầu vào đổi.
 */
export function useTrafficOverview({ reports, vehicle, demoIncidents, t }: Options) {
  const visibleReports = useMemo(() => reportsForVehicle(reports, vehicle), [reports, vehicle]);
  const incidents = useMemo(() => toIncidents(visibleReports), [visibleReports]);
  const reportsLayer = useMemo(
    () => translateLayerTitles(toReportsMapLayer(visibleReports), t),
    [visibleReports, t],
  );
  const trafficLayer = useMemo(
    () => mergeDemoIncidents(reportsLayer, demoIncidents, t),
    [reportsLayer, demoIncidents, t],
  );
  const routeIncidents = useMemo(() => avoidableIncidents(trafficLayer), [trafficLayer]);
  return { incidents, trafficLayer, routeIncidents };
}
