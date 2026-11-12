import type { Feature, FeatureCollection, Point } from 'geojson';

/**
 * HỢP ĐỒNG CHUNG N1 ↔ N2: TrafficMapLayer
 *
 * N2 (module traffic) cung cấp dữ liệu sự cố dưới dạng GeoJSON FeatureCollection.
 * N1 (MapView) chỉ đọc dữ liệu theo đúng hợp đồng này để vẽ marker,
 * nên hai bên có thể đổi cách lưu trữ/realtime mà không ảnh hưởng nhau.
 *
 * Lưu ý: GeoJSON dùng thứ tự tọa độ [lng, lat].
 * Mọi thay đổi file này cần cả N1 và N2 review.
 */

export type TrafficSeverity = 'low' | 'medium' | 'high';
export type TrafficVehicleScope = 'car' | 'motorcycle' | 'both';

/** Thuộc tính của một sự cố hiển thị trên bản đồ. */
export type TrafficFeatureProperties = {
  id: string;
  /** Loại sự cố: traffic_jam, accident, construction, flood, road_closure, obstacle. */
  incidentType: string;
  severity: TrafficSeverity;
  /** Phạm vi loại xe áp dụng sự cố. */
  vehicleScope: TrafficVehicleScope;
  /** Tiêu đề ngắn hiển thị trong popup, ví dụ "Kẹt xe". */
  title: string;
  /** Chỉ sự cố 'active' được vẽ; đã thông thoáng hoặc hết hạn thì bỏ qua. */
  status: 'active' | 'cleared' | 'expired';
  /** true nếu đã được xác minh (nhiều người xác nhận/AI), false nếu chỉ là 1 báo cáo. */
  verified: boolean;
  /** Thời điểm báo cáo (ISO 8601), không bắt buộc. */
  reportedAt?: string;
  /** Số báo cáo cùng loại gần nhau (75 m / 30 phút) được gộp vào sự cố này. */
  communityReportCount?: number;
  /** Số người khác nhau đã báo/xác nhận; > 1 thì marker hiện con số thay cho "!". */
  communityReporterCount?: number;
  /** Lần xác nhận gần nhất (ISO 8601). */
  communityUpdatedAt?: string;
};

export type TrafficFeature = Feature<Point, TrafficFeatureProperties>;
export type TrafficMapLayer = FeatureCollection<Point, TrafficFeatureProperties>;

/** Dữ liệu tối thiểu để tạo một feature từ tọa độ {lat, lng}. */
type TrafficPointInput = Omit<TrafficFeatureProperties, 'status' | 'verified'> & {
  lat: number;
  lng: number;
  status?: TrafficFeatureProperties['status'];
  verified?: boolean;
};

/** Tạo TrafficMapLayer từ danh sách điểm {lat, lng}, tự đổi sang thứ tự GeoJSON [lng, lat]. */
export function toTrafficMapLayer(points: TrafficPointInput[]): TrafficMapLayer {
  return {
    type: 'FeatureCollection',
    features: points.map(({ lat, lng, status = 'active', verified = false, ...properties }) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: { ...properties, status, verified },
    })),
  };
}
