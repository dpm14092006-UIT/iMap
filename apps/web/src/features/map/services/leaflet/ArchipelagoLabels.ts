import * as L from 'leaflet';
import type { Language } from '../../../../shared/i18n/translate';
import {
  EAST_SEA,
  ISLAND_LABEL_MIN_ZOOM,
  SOVEREIGN_NAME,
  VIETNAM_ARCHIPELAGOS,
  VIETNAM_ISLANDS,
} from '../../domain/vietnamArchipelagos';
import { textElement, toggleGroup } from './drawing';

const PANE = 'sovereignty-labels';

/** Nhãn chữ không bắt sự kiện (click xuyên xuống bản đồ), dựng bằng textContent. */
function textLabel(lines: string[], className: string, point: L.LatLngExpression, pane: string): L.Marker {
  const element = document.createElement('div');
  lines.forEach((line, index) =>
    element.append(
      textElement('span', line),
      ...(index < lines.length - 1 ? [document.createElement('br')] : []),
    ),
  );
  return L.marker(point, {
    pane,
    interactive: false,
    keyboard: false,
    icon: L.divIcon({ className: `sovereignty-label ${className}`, html: element, iconSize: [0, 0] }),
  });
}

/**
 * Tên tiếng Việt của Quần đảo Hoàng Sa, Quần đảo Trường Sa (kèm "Việt Nam"), Biển Đông và các đảo tiêu biểu,
 * vẽ trên mọi lớp nền và mọi mức zoom. Nằm trên ô bản đồ, dưới tuyến đường và marker.
 */
export class ArchipelagoLabels {
  private readonly archipelagos = L.layerGroup();
  private readonly islands = L.layerGroup();
  private readonly sea = L.layerGroup();
  private language: Language | null = null;
  private suppressed = false;

  constructor(
    private readonly map: L.Map,
    language: Language,
  ) {
    if (!map.getPane(PANE)) {
      const pane = map.createPane(PANE);
      pane.style.zIndex = '350'; // trên tilePane (200), dưới overlayPane (400) nơi vẽ tuyến
      pane.style.pointerEvents = 'none';
    }
    this.archipelagos.addTo(map);
    this.setLanguage(language);
    map.on('zoomend', this.syncZoom);
    this.syncZoom();
  }

  setLanguage(language: Language) {
    if (language === this.language) return;
    this.language = language;
    this.archipelagos.clearLayers();
    this.islands.clearLayers();
    this.sea.clearLayers();
    for (const archipelago of VIETNAM_ARCHIPELAGOS) {
      textLabel(
        [archipelago.name[language], `(${SOVEREIGN_NAME[language]})`],
        'sovereignty-label--archipelago',
        archipelago.label,
        PANE,
      ).addTo(this.archipelagos);
    }
    for (const island of VIETNAM_ISLANDS) {
      textLabel([island.name[language]], 'sovereignty-label--island', [island.lat, island.lng], PANE).addTo(
        this.islands,
      );
    }
    textLabel([EAST_SEA.name[language]], 'sovereignty-label--sea', EAST_SEA.label, PANE).addTo(this.sea);
  }

  /** Số nhãn đang vẽ trên bản đồ (dùng cho kiểm thử). */
  visibleLabelCount(): number {
    return [this.archipelagos, this.islands, this.sea]
      .filter((group) => this.map.hasLayer(group))
      .reduce((total, group) => total + group.getLayers().length, 0);
  }

  /**
   * Tắt nhãn của iMap khi nền bản đồ đã tự thể hiện tên chủ quyền (ví dụ lớp sov của vApp, bản đồ hành chính
   * VNSDI), để không chồng chữ. Bật lại khi nền không có nhãn (ảnh vệ tinh, nền dự phòng).
   */
  setSuppressed(suppressed: boolean) {
    if (suppressed === this.suppressed) return;
    this.suppressed = suppressed;
    toggleGroup(this.map, this.archipelagos, !suppressed);
    this.syncZoom();
  }

  destroy() {
    this.map.off('zoomend', this.syncZoom);
    this.archipelagos.remove();
    this.islands.remove();
    this.sea.remove();
  }

  private readonly syncZoom = () => {
    const zoom = this.map.getZoom();
    toggleGroup(this.map, this.islands, !this.suppressed && zoom >= ISLAND_LABEL_MIN_ZOOM);
    toggleGroup(this.map, this.sea, !this.suppressed && zoom <= EAST_SEA.maxZoom);
  };
}
