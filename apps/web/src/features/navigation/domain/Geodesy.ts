import type { LatLng } from '../../places/types';

/** Phép tính khoảng cách và chiếu điểm lên đoạn thẳng trên mặt cầu/mặt phẳng cục bộ. */
export class Geodesy {
  private static readonly EARTH_RADIUS_METERS = 6_371_000;
  /** Số mét trên một độ vĩ độ (gần như không đổi). */
  private static readonly METERS_PER_DEGREE_LAT = 111_320;

  /** Khoảng cách đường chim bay (haversine), đơn vị mét. */
  static distanceMeters(a: LatLng, b: LatLng): number {
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const latDelta = toRadians(b.lat - a.lat);
    const lngDelta = toRadians(b.lng - a.lng);
    const haversine =
      Math.sin(latDelta / 2) ** 2 +
      Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(lngDelta / 2) ** 2;
    return 2 * Geodesy.EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
  }

  /**
   * Chiếu `point` lên đoạn start→end.
   * `fraction` ∈ [0, 1] là vị trí hình chiếu dọc đoạn; `distance` là khoảng cách (mét) từ điểm tới hình chiếu.
   */
  static projectOntoSegment(
    point: LatLng,
    start: LatLng,
    end: LatLng,
  ): { fraction: number; distance: number } {
    const lngScale = Geodesy.METERS_PER_DEGREE_LAT * Math.cos((point.lat * Math.PI) / 180);
    const dx = (end.lng - start.lng) * lngScale;
    const dy = (end.lat - start.lat) * Geodesy.METERS_PER_DEGREE_LAT;
    const px = (point.lng - start.lng) * lngScale;
    const py = (point.lat - start.lat) * Geodesy.METERS_PER_DEGREE_LAT;
    const lengthSquared = dx * dx + dy * dy;
    const fraction = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSquared));
    const projected = {
      lat: start.lat + (end.lat - start.lat) * fraction,
      lng: start.lng + (end.lng - start.lng) * fraction,
    };
    return { fraction, distance: Geodesy.distanceMeters(point, projected) };
  }
}
