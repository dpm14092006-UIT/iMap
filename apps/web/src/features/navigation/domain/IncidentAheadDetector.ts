import type { LatLng } from '../../places/types';
import type { RoutePath } from './RoutePath';

/** Sự cố có thể chặn đường (lấy từ lớp giao thông của N2). */
export type RouteIncident = LatLng & { id: string; title: string };

/** Sự cố tìm thấy phía trước và còn cách bao xa (mét, đo dọc tuyến). */
export type IncidentAhead = { incident: RouteIncident; distanceAheadMeters: number };

/**
 * Phát hiện sự cố NẰM TRÊN tuyến và ở PHÍA TRƯỚC vị trí hiện tại, để tính lại tuyến trước khi tới nơi.
 * Mỗi sự cố chỉ báo một lần (dù tránh được hay không) để không gọi tính lại tuyến liên tục.
 */
export class IncidentAheadDetector {
  /** Sự cố cách tuyến dưới bao nhiêu mét thì coi là chặn tuyến. */
  static readonly INCIDENT_RADIUS_METERS = 60;
  /** Chỉ quan tâm sự cố trong đoạn phía trước bao xa (mét). */
  static readonly LOOKAHEAD_METERS = 1500;

  private readonly handled = new Set<string>();

  /**
   * @param path hình học tuyến đang dẫn (RoutePath của N2)
   * @param progressMeters đã đi được bao xa dọc hình học tuyến
   */
  findAhead(path: RoutePath, progressMeters: number, incidents: RouteIncident[]): IncidentAhead | null {
    let nearest: IncidentAhead | null = null;
    for (const incident of incidents) {
      if (this.handled.has(incident.id)) continue;
      // Chỉ khớp với phần tuyến phía trước để bỏ qua sự cố đã đi qua.
      const match = path.closest(incident, progressMeters);
      if (!match || match.distance > IncidentAheadDetector.INCIDENT_RADIUS_METERS) continue;
      const distanceAheadMeters = match.progress - progressMeters;
      if (distanceAheadMeters > IncidentAheadDetector.LOOKAHEAD_METERS) continue;
      if (!nearest || distanceAheadMeters < nearest.distanceAheadMeters)
        nearest = { incident, distanceAheadMeters };
    }
    return nearest;
  }

  /** Đánh dấu đã xử lý để không báo lại. */
  markHandled(incidentId: string): void {
    this.handled.add(incidentId);
  }

  /** Bắt đầu chuyến mới: quên các sự cố đã xử lý. */
  reset(): void {
    this.handled.clear();
  }
}
