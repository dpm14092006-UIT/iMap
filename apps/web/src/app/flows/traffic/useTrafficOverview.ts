import type { TrafficReportDto } from '@routetwin/shared';
import { useMemo } from 'react';
import type { TransportMode } from '../../../features/routing/types';
import {
  avoidableIncidents,
  reportsForVehicle,
  translateLayerTitles,
} from '../../../features/traffic/domain/trafficOverview';
import { toIncidents, toReportsMapLayer } from '../../../features/traffic/domain/trafficPresentation';

type Options = {
  reports: TrafficReportDto[];
  /** Loại xe đang xem: chỉ hiện sự cố áp dụng cho xe này. */
  vehicle: TransportMode;
  t: (text: string) => string;
};

/**
 * Bức tranh giao thông dùng chung cho bản đồ, panel và dẫn đường (xem `buildTrafficOverview`);
 * mỗi bước được nhớ riêng để chỉ tính lại phần có đầu vào đổi.
 */
export function useTrafficOverview({ reports, vehicle, t }: Options) {
  const visibleReports = useMemo(() => reportsForVehicle(reports, vehicle), [reports, vehicle]);
  const incidents = useMemo(() => toIncidents(visibleReports), [visibleReports]);
  const trafficLayer = useMemo(
    () => translateLayerTitles(toReportsMapLayer(visibleReports), t),
    [visibleReports, t],
  );
  const routeIncidents = useMemo(() => avoidableIncidents(trafficLayer), [trafficLayer]);
  return { incidents, trafficLayer, routeIncidents };
}
