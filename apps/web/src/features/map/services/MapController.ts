import type { LatLng } from '../../../shared/geo/types';
import type { Language } from '../../../shared/i18n/translate';
import type { Poi } from '../../explore/types';
import type { RoutePlan } from '../../routing/types';
import type { TrafficMapLayer } from '../../traffic/domain/trafficMapLayer';
import type { DraftStops, MapLayer, MapOverlays } from '../types';

/** Vùng bị bảng chức năng che (px): trái/phải ở desktop, đáy ở mobile. */
export type FitInsets = { left: number; right?: number; bottom: number };

export type MapBounds = { minLat: number; minLng: number; maxLat: number; maxLng: number };

export type MapControllerHandlers = {
  onMapClick: (point: LatLng) => void;
  /** Bấm vào tuyến phụ hoặc nhãn tuyến trên bản đồ. */
  onSelectRoute?: (routeId: string) => void;
  onPoiClick?: (poiId: string) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
};

/** Toàn bộ dữ liệu cần vẽ trên bản đồ, được MapView truyền vào mỗi khi thay đổi. */
export type MapControllerData = {
  language: Language;
  layer: MapLayer;
  route: RoutePlan | null;
  routeOptions: RoutePlan[];
  draftStops: DraftStops;
  trafficLayer: TrafficMapLayer;
  currentLocation: LatLng | null;
  headingDegrees: number | null;
  isNavigating: boolean;
  isPicking: boolean;
  overlays: MapOverlays;
  pois: Poi[];
  highlightedPoiId: string | null;
};

/**
 * Hợp đồng giữa React và bộ máy bản đồ (Leaflet hôm nay, MapLibre GL khi chuyển xong).
 * React và các flow trong `app/` chỉ gọi những method này, không chạm thư viện bản đồ.
 */
export interface MapController {
  /** Vẽ lại bản đồ theo dữ liệu mới nhất. */
  update(data: MapControllerData): void;
  /** Khớp khung toàn vẹn lãnh thổ 4°30′–23°30′B, 102°–118°Đ (Điều 20.1). */
  showVietnam(): void;
  zoomIn(): void;
  zoomOut(): void;
  flyTo(point: LatLng, zoom?: number): void;
  followLocation(point: LatLng, zoom?: number): void;
  /** Nghe thao tác kéo/zoom của người dùng; trả về hàm hủy. */
  onUserGesture(listener: () => void): () => void;
  getZoom(): number;
  getCenter(): LatLng;
  /** Zoom vừa các điểm, chừa chỗ cho bảng đang mở. */
  fitPoints(points: LatLng[]): void;
  /** Zoom vừa khít một tuyến (nút "Xem trước"). */
  fitRoute(route: RoutePlan): void;
  setFitInsets(insets: FitInsets | null): void;
  /** Zoom lại vừa vùng vừa fit gần nhất (khi bảng đổi kích thước). */
  refit(): void;
  invalidateSize(): void;
  destroy(): void;
}
