import type { TrafficReportBounds } from '@routetwin/shared';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { LatLng } from '../../../shared/geo/types';
import { useI18n } from '../../../shared/i18n/I18nProvider';
import type { Poi } from '../../explore/types';
import type { RoutePlan } from '../../routing/types';
import type { TrafficMapLayer } from '../../traffic/domain/trafficMapLayer';
import type { MapCamera, MapController } from '../services/MapController';
import type { DraftStops, MapLayer, MapOverlays } from '../types';

type MapViewProps = {
  layer: MapLayer;
  route: RoutePlan | null;
  routeOptions: RoutePlan[];
  /** Điểm đi/đến đã chọn nhưng chưa có tuyến. */
  draftStops: DraftStops;
  /** Dữ liệu sự cố theo hợp đồng chung với N2. */
  trafficLayer: TrafficMapLayer;
  currentLocation: LatLng | null;
  headingDegrees: number | null;
  isNavigating: boolean;
  /** Đang ở chế độ chọn điểm trên bản đồ (đổi con trỏ). */
  isPicking: boolean;
  overlays: MapOverlays;
  /** Địa điểm đang hiển thị từ chức năng khám phá / tìm dọc tuyến. */
  pois: Poi[];
  highlightedPoiId: string | null;
  controllerRef: MutableRefObject<MapController | null>;
  onMapClick: (point: LatLng) => void;
  onBoundsChange: (bounds: TrafficReportBounds) => void;
  onSelectRoute: (routeId: string) => void;
  onPoiClick: (poiId: string) => void;
  /** Chế độ 3D (nghiêng, dẫn đường xoay theo hướng đi). */
  view3d?: boolean;
  /** 4D: mốc thời gian mô phỏng ánh sáng (ms); null = mặc định. */
  lightTime?: number | null;
  /** Hướng xoay / độ nghiêng của bản đồ (la bàn). */
  onCameraChange?: (camera: MapCamera) => void;
};

/** Component React bọc bộ máy bản đồ (MapController): tạo bản đồ 1 lần, sau đó chỉ truyền dữ liệu mới. */
export function MapView({
  layer,
  route,
  routeOptions,
  draftStops,
  trafficLayer,
  currentLocation,
  headingDegrees,
  isNavigating,
  isPicking,
  overlays,
  pois,
  highlightedPoiId,
  controllerRef,
  onMapClick,
  onBoundsChange,
  onSelectRoute,
  onPoiClick,
  view3d = false,
  lightTime = null,
  onCameraChange,
}: MapViewProps) {
  const { language, t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  // Tăng mỗi khi bản đồ sẵn sàng (MapLibre tạo bất đồng bộ) để lần vẽ đầu tiên không bị bỏ lỡ.
  const [ready, setReady] = useState(0);
  // Giữ handler mới nhất trong ref để không phải tạo lại bản đồ khi callback đổi.
  const handlersRef = useRef({ onMapClick, onBoundsChange, onSelectRoute, onPoiClick, onCameraChange });
  handlersRef.current = { onMapClick, onBoundsChange, onSelectRoute, onPoiClick, onCameraChange };

  // Tạo bản đồ khi mount, hủy khi unmount. MapLibre GL (WebGL) tải riêng để giao diện hiện trước.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let controller: MapController | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const handlers = {
      onBoundsChange: (bounds: TrafficReportBounds) => handlersRef.current.onBoundsChange(bounds),
      onMapClick: (point: LatLng) => handlersRef.current.onMapClick(point),
      onSelectRoute: (routeId: string) => handlersRef.current.onSelectRoute(routeId),
      onPoiClick: (poiId: string) => handlersRef.current.onPoiClick(poiId),
      onCameraChange: (camera: MapCamera) => handlersRef.current.onCameraChange?.(camera),
    };
    const attach = (created: MapController) => {
      if (disposed) {
        created.destroy();
        return;
      }
      controller = created;
      controllerRef.current = created;
      resizeObserver = new ResizeObserver(() => created.invalidateSize());
      resizeObserver.observe(container);
      setReady((count) => count + 1);
    };
    void import('../services/MaplibreMapController').then(({ MaplibreMapController }) =>
      attach(new MaplibreMapController(container, handlers)),
    );
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      if (controller && controllerRef.current === controller) controllerRef.current = null;
      controller?.destroy();
    };
  }, [controllerRef]);

  // Vẽ lại khi dữ liệu thay đổi.
  useEffect(() => {
    controllerRef.current?.update({
      language,
      layer,
      route,
      routeOptions,
      draftStops,
      trafficLayer,
      currentLocation,
      headingDegrees,
      isNavigating,
      isPicking,
      overlays,
      pois,
      highlightedPoiId,
      view3d,
      lightTime,
    });
  }, [
    controllerRef,
    ready,
    language,
    layer,
    route,
    routeOptions,
    draftStops,
    trafficLayer,
    currentLocation,
    headingDegrees,
    isNavigating,
    isPicking,
    overlays,
    pois,
    highlightedPoiId,
    view3d,
    lightTime,
  ]);

  return (
    <div
      ref={containerRef}
      className="routetwin-map absolute inset-0 z-0"
      data-map-engine="maplibre"
      role="region"
      aria-label={t('Bản đồ tương tác Việt Nam')}
    />
  );
}
