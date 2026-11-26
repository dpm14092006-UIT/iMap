import { usable3d, type BasemapProvider, type Features3d } from '../../basemap/providers';
import type { GLMap } from './gl';

/** Lớp khối toà nhà do iMap thêm (tiền tố rt-: lớp của iMap, không phải của nhà cung cấp). */
export const BUILDINGS_3D_LAYER = 'rt-3d-buildings';
const TERRAIN_EXAGGERATION = 1.3;

/**
 * Địa hình nổi và toà nhà khối từ dữ liệu sẵn có của nguồn nền (registry `features3d`).
 * Chỉ THÊM địa hình và một lớp khối của iMap (dưới các lớp chữ để nhãn — kể cả tên chủ quyền — vẫn nằm trên);
 * không ẩn, lọc hay đổi lớp nào của nhà cung cấp. Production chỉ bật khi registry có phê duyệt.
 */
export class Map3D {
  private active: Features3d | null = null;

  constructor(
    private readonly map: GLMap,
    private readonly production: boolean,
    /** Ghi nguồn bắt buộc khi bật (vd. dữ liệu độ cao); null khi tắt. */
    private readonly onAttribution: (text: string | null) => void,
  ) {}

  /** Gọi khi đổi nền, bật/tắt 3D, và sau mỗi lần style mới nạp xong. */
  apply(provider: BasemapProvider | null, enabled: boolean) {
    // Không chờ isStyleLoaded() (false cả khi ô đang tải): chỉ dùng nguồn đã có trong style hiện tại; style mới
    // nạp xong thì MaplibreMapController gọi lại hàm này.
    const features = enabled ? usable3d(provider, this.production) : null;
    const terrain =
      features?.terrainSource && this.map.getSource(features.terrainSource) ? features.terrainSource : null;
    if (terrain) this.map.setTerrain({ source: terrain, exaggeration: TERRAIN_EXAGGERATION });
    else if (this.map.getTerrain()) this.map.setTerrain(null);

    const buildings =
      features?.buildings && this.map.getSource(features.buildings.source) ? features.buildings : null;
    const hasLayer = Boolean(this.map.getLayer(BUILDINGS_3D_LAYER));
    if (buildings && !hasLayer) {
      // Chèn dưới lớp chữ đầu tiên của style: nhãn (gồm tên chủ quyền) luôn nằm trên khối toà nhà.
      const firstLabel = this.map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
      this.map.addLayer(
        {
          id: BUILDINGS_3D_LAYER,
          type: 'fill-extrusion',
          source: buildings.source,
          'source-layer': buildings.sourceLayer,
          minzoom: 14,
          paint: {
            'fill-extrusion-color': '#d9d0c9',
            'fill-extrusion-height': ['coalesce', ['to-number', ['get', buildings.heightField]], 6],
            'fill-extrusion-opacity': 0.88,
          },
        },
        firstLabel,
      );
    } else if (!buildings && hasLayer) this.map.removeLayer(BUILDINGS_3D_LAYER);

    this.active = terrain || buildings ? features : null;
    this.onAttribution(this.active?.attribution ?? null);
  }

  /** Đang bật địa hình/toà nhà (kiểm thử, cổng kiểm chứng). */
  isActive(): boolean {
    return this.active !== null;
  }
}
