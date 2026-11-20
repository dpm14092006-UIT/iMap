import * as L from 'leaflet';
import type { MapLayer } from '../../types';
import { toggleGroup } from './drawing';

/**
 * Nguồn ô bản đồ nền "Lớp" (nhãn tiếng Việt), chọn theo mức zoom:
 * - zoom ≤ 10: OSM France HOT — tên địa phương ở mọi mức zoom (Esri ở zoom xa in tên tiếng Anh/không dấu).
 * - zoom ≥ 11: Esri World Street Map — nhanh, ổn định, tên tiếng Việt có dấu.
 * Mỗi nguồn có dự phòng khi một ô tải lỗi. Lưu ý Esri dùng thứ tự {y}/{x}.
 * (tile.openstreetmap.org hay cắt kết nối/chặn lưu lượng dùng chung → bản đồ trống trên điện thoại.)
 */
const LOW_ZOOM_MAX = 10;
const HOT_TILES = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
const ESRI_STREET_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const OSM_DE_TILES = 'https://tile.openstreetmap.de/{z}/{x}/{y}.png';

/** Lớp ô bản đồ: ô nào tải lỗi thì tải lại một lần từ `fallbackUrl` (cùng vị trí). */
function tileLayerWithFallback(url: string, fallbackUrl: string, options: L.TileLayerOptions): L.TileLayer {
  const layer = L.tileLayer(url, options);
  layer.on('tileerror', ({ tile, coords }) => {
    if (tile.dataset.fallback) return;
    tile.dataset.fallback = '1';
    tile.src = L.Util.template(fallbackUrl, { ...coords, s: 'a' });
  });
  return layer;
}

/** Bản đồ nền: đường phố (mặc định), vệ tinh kèm nhãn, địa hình; nền tối dùng class CSS. */
export class BaseLayers {
  /** Bản đồ nền "Lớp": 2 nguồn theo mức zoom (xem LOW_ZOOM_MAX). */
  private readonly streets: L.LayerGroup;
  private readonly imagery: L.TileLayer;
  /** Nhãn tên đường / địa điểm phủ lên ảnh vệ tinh (ảnh Esri không có nhãn). */
  private readonly imageryLabels: L.LayerGroup;
  private readonly terrain: L.TileLayer;

  constructor(private readonly map: L.Map) {
    this.streets = L.layerGroup([
      tileLayerWithFallback(HOT_TILES, ESRI_STREET_TILES, {
        maxZoom: LOW_ZOOM_MAX,
        attribution: '© OpenStreetMap · HOT · OSM France',
      }),
      tileLayerWithFallback(ESRI_STREET_TILES, OSM_DE_TILES, {
        minZoom: LOW_ZOOM_MAX + 1,
        maxZoom: 19,
        attribution: 'Tiles © Esri',
      }),
    ]);
    this.imagery = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Imagery © Esri, Vantor, Earthstar Geographics, and the GIS User Community',
      },
    );
    // Ảnh vệ tinh không có chữ nên phủ thêm 2 lớp tham chiếu của Esri (nền trong suốt, nhãn tiếng Việt):
    // đường + tên đường (làm mờ 25% để vẫn thấy mặt đường thật) và tên địa điểm. zIndex > ảnh để nằm trên.
    const esriReference = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference';
    this.imageryLabels = L.layerGroup([
      L.tileLayer(`${esriReference}/World_Transportation/MapServer/tile/{z}/{y}/{x}`, {
        maxZoom: 19,
        opacity: 0.75,
        zIndex: 2,
      }),
      L.tileLayer(`${esriReference}/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, {
        maxZoom: 19,
        zIndex: 3,
      }),
    ]);
    this.terrain = L.tileLayer('https://tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution:
        '<a href="https://opentopomap.org" target="_blank" rel="noreferrer">© OpenTopoMap (CC-BY-SA)</a>',
    });
    this.streets.addTo(map);
  }

  /**
   * Chọn nền: vệ tinh, địa hình (lớp phủ) hoặc đường phố. 'dark' dùng chung tile OSM với 'street'
   * nhưng thêm class CSS để đảo màu (xem styles.css).
   */
  apply(layer: MapLayer, terrain: boolean) {
    const base = layer === 'satellite' ? this.imagery : terrain ? this.terrain : this.streets;
    for (const candidate of [this.streets, this.imagery, this.terrain]) {
      if (candidate !== base && this.map.hasLayer(candidate)) this.map.removeLayer(candidate);
    }
    if (!this.map.hasLayer(base)) base.addTo(this.map);
    toggleGroup(this.map, this.imageryLabels, layer === 'satellite'); // chế độ "vệ tinh + nhãn" (hybrid)
    this.map.getContainer().classList.toggle('map-theme-dark', layer === 'dark');
  }
}
