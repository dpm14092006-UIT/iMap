import * as L from 'leaflet';
import type { AlgorithmOverlay } from '../../../routing/types';

/**
 * Kết quả Dijkstra / A* (chế độ thuyết trình): Dijkstra nét liền tím (dày, bên dưới), A* nét đứt cam
 * (bên trên), khung nét đứt xám là vùng có dữ liệu đồ thị. Hai tuyến thường trùng nhau vì cùng chi phí tối ưu.
 */
export class AlgorithmLayer {
  readonly group = L.layerGroup();
  private lastKey: string | null = null;

  /** Vẽ lại; trả về các điểm cần zoom vừa khi có kết quả MỚI, ngược lại null. */
  update(overlay: AlgorithmOverlay | null): L.LatLngExpression[] | null {
    this.group.clearLayers();
    if (overlay?.coverage) {
      const { south, west, north, east } = overlay.coverage;
      L.rectangle(
        [
          [south, west],
          [north, east],
        ],
        { color: '#64748b', weight: 1.5, dashArray: '6 6', fill: false, interactive: false },
      ).addTo(this.group);
    }
    for (const path of overlay?.paths ?? []) {
      if (path.points.length < 2) continue;
      const style: L.PolylineOptions =
        path.algorithm === 'dijkstra'
          ? { color: '#8b5cf6', weight: 8, opacity: 0.55 }
          : { color: '#f97316', weight: 4, opacity: 0.95, dashArray: '8 7' };
      L.polyline(path.points, { ...style, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(
        this.group,
      );
    }
    const points = overlay?.paths.flatMap((path) => path.points) ?? [];
    const isNew = Boolean(overlay && overlay.key !== this.lastKey && points.length);
    this.lastKey = overlay?.key ?? null;
    return isNew ? points : null;
  }
}
