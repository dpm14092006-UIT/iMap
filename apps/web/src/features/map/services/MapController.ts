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
  /** Hướng xoay (độ, 0 = Bắc) và độ nghiêng (độ) của bản đồ, cho la bàn. */
  onCameraChange?: (camera: MapCamera) => void;
};

export type MapCamera = { bearing: number; pitch: number };

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
  /** Chế độ 3D: nghiêng bản đồ, dẫn đường xoay theo hướng đi, địa hình/toà nhà khối khi nguồn cho phép. */
  view3d: boolean;
  /** 4D: mốc thời gian (ms) để mô phỏng ánh sáng mặt trời; null = ánh sáng mặc định. */
  lightTime: number | null;
};

/**
 * Hợp đồng giữa React và bộ máy bản đồ (MapLibre GL).
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
  /** Xoay về hướng Bắc (nút la bàn). */
  resetNorth(): void;
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
  /** 4D: đặt camera và mũi tên phát lại hành trình tại một khung hình; null = thoát phát lại. */
  showPlayback(frame: { point: LatLng; heading: number } | null): void;
  destroy(): void;
}
