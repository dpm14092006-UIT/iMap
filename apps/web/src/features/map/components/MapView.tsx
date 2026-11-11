import type { TrafficReportBounds } from '@routetwin/shared';
import { useEffect, useRef, type MutableRefObject } from 'react';
import type { LatLng } from '../../places/types';
import type { TrafficMapLayer } from '../layers/trafficMapLayer';
import { LeafletMapController } from '../services/LeafletMapController';
import type { AlgorithmOverlay, DraftStops, MapLayer, RoutePlan } from '../types';

type MapViewProps = {
  layer: MapLayer;
  route: RoutePlan | null;
  /** Điểm đi/đến đã chọn nhưng chưa có tuyến. */
  draftStops: DraftStops;
  /** Dữ liệu sự cố theo hợp đồng chung với N2. */
  trafficLayer: TrafficMapLayer;
  currentLocation: LatLng | null;
  /** Đang ở chế độ chọn điểm trên bản đồ (đổi con trỏ). */
  isPicking: boolean;
  /** Tuyến Dijkstra/A* để so sánh (null nếu chưa chạy). */
  algorithmOverlay: AlgorithmOverlay | null;
  controllerRef: MutableRefObject<LeafletMapController | null>;
  onMapClick: (point: LatLng) => void;
  onBoundsChange: (bounds: TrafficReportBounds) => void;
};

/** Component React bọc LeafletMapController: tạo bản đồ 1 lần, sau đó chỉ truyền dữ liệu mới. */
export function MapView({
  layer,
  route,
  draftStops,
  trafficLayer,
  currentLocation,
  isPicking,
  algorithmOverlay,
  controllerRef,
  onMapClick,
  onBoundsChange,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Giữ handler mới nhất trong ref để không phải tạo lại bản đồ khi callback đổi.
  const handlersRef = useRef({ onMapClick, onBoundsChange });
  handlersRef.current = { onMapClick, onBoundsChange };

  // Tạo bản đồ khi mount, hủy khi unmount.
  useEffect(() => {
    if (!containerRef.current) return;
    const controller = new LeafletMapController(containerRef.current, {
      onBoundsChange: (bounds) => handlersRef.current.onBoundsChange(bounds),
      onMapClick: (point) => handlersRef.current.onMapClick(point),
    });
    controllerRef.current = controller;
    const resizeObserver = new ResizeObserver(() => controller.invalidateSize());
    resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
      if (controllerRef.current === controller) controllerRef.current = null;
      controller.destroy();
    };
  }, [controllerRef]);

  // Vẽ lại khi dữ liệu thay đổi.
  useEffect(() => {
    controllerRef.current?.update({
      layer,
      route,
      draftStops,
      trafficLayer,
      currentLocation,
      isPicking,
      algorithmOverlay,
    });
  }, [controllerRef, layer, route, draftStops, trafficLayer, currentLocation, isPicking, algorithmOverlay]);

  return (
    <div
      ref={containerRef}
      className="routetwin-leaflet absolute inset-0 z-0"
      role="region"
      aria-label="Bản đồ tương tác Việt Nam"
    />
  );
}
