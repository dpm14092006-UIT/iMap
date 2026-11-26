import type { RefObject } from 'react';
import type { TrafficReportDto, TrafficReportInput } from '@routetwin/shared';
import type { MapController } from '../../../features/map/services/MapController';
import type { IncidentKind, IncidentSeverity, TrafficVehicleScope } from '../../../features/traffic/types';
import type { LatLng } from '../../../shared/geo/types';

type Options = {
  accessToken: string | null;
  createReport: (input: TrafficReportInput, photo?: File) => Promise<TrafficReportDto>;
  updateClearance: (id: string, state: 'clear' | 'still_active') => Promise<unknown>;
  openSignIn: () => void;
  onReported: () => void;
  mapController: RefObject<MapController | null>;
  showToast: (message: string) => void;
  t: (text: string) => string;
};

/** Gửi và xác minh báo cáo giao thông qua API; cả hai đều yêu cầu đăng nhập. */
export function useTrafficReporting(options: Options) {
  const { accessToken, createReport, updateClearance, openSignIn, onReported, mapController, showToast, t } =
    options;

  /** Chưa đăng nhập thì mở bảng đăng nhập và ném lỗi để panel đang mở hiển thị lý do. */
  const requireSignIn = (message: string) => {
    if (accessToken) return;
    openSignIn();
    throw new Error(message);
  };

  const report = async (
    type: IncidentKind,
    severity: IncidentSeverity,
    vehicleScope: TrafficVehicleScope,
    point: LatLng,
    note: string,
    photo: File | null,
  ) => {
    requireSignIn(t('Đăng nhập để gửi báo cáo.'));
    const created = await createReport(
      {
        incidentType: type,
        severity,
        vehicleScope,
        lat: point.lat,
        lng: point.lng,
        ...(note ? { note } : {}),
      },
      photo ?? undefined,
    );
    onReported();
    mapController.current?.flyTo(point, 15);
    showToast(
      created.vehicleScope === vehicleScope
        ? t('Đã đồng bộ báo cáo giao thông')
        : t(
            'Đã gửi báo cáo; máy chủ chưa hỗ trợ phân theo loại xe nên cảnh báo tạm áp dụng cho cả ô tô và xe máy.',
          ),
    );
  };

  const verify = async (id: string, state: 'clear' | 'still_active') => {
    requireSignIn(t('Đăng nhập để xác minh báo cáo.'));
    await updateClearance(id, state);
  };

  return { report, verify, requireSignIn };
}
