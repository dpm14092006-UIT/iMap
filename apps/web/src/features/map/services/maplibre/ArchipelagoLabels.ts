import type { Language } from '../../../../shared/i18n/translate';
import {
  EAST_SEA,
  ISLAND_LABEL_MIN_ZOOM,
  SOVEREIGN_NAME,
  VIETNAM_ARCHIPELAGOS,
  VIETNAM_ISLANDS,
} from '../../domain/vietnamArchipelagos';
import { fromGLZoom, maplibregl, textElement, type GLMap } from './gl';

type Group = 'archipelago' | 'island' | 'sea';

/**
 * Tên tiếng Việt của Quần đảo Hoàng Sa, Quần đảo Trường Sa (kèm "Việt Nam"), Biển Đông và các đảo tiêu biểu,
 * vẽ trên mọi lớp nền. Dựng bằng phần tử HTML (không phụ thuộc font của nguồn nền), nên giữ nguyên khi đổi nền.
 * Tự tắt khi nền đã có nhãn chủ quyền (ví dụ lớp sov của vApp), để không chồng chữ.
 */
export class ArchipelagoLabels {
  private markers: { group: Group; marker: maplibregl.Marker }[] = [];
  private language: Language | null = null;
  private suppressed = false;

  constructor(
    private readonly map: GLMap,
    language: Language,
  ) {
    this.setLanguage(language);
    map.on('zoom', this.sync);
  }

  setLanguage(language: Language) {
    if (language === this.language) return;
    this.language = language;
    this.removeAll();
    for (const archipelago of VIETNAM_ARCHIPELAGOS) {
      const [lat, lng] = archipelago.label;
      this.add(
        'archipelago',
        [archipelago.name[language], `(${SOVEREIGN_NAME[language]})`],
        'sovereignty-label--archipelago',
        [lng, lat],
      );
    }
    for (const island of VIETNAM_ISLANDS)
      this.add('island', [island.name[language]], 'sovereignty-label--island', [island.lng, island.lat]);
    const [seaLat, seaLng] = EAST_SEA.label;
    this.add('sea', [EAST_SEA.name[language]], 'sovereignty-label--sea', [seaLng, seaLat]);
    this.sync();
  }

  /** Số nhãn đang vẽ trên bản đồ (dùng cho kiểm thử). */
  visibleLabelCount(): number {
    return this.markers.filter(({ marker }) => marker.getElement().isConnected).length;
  }

  setSuppressed(suppressed: boolean) {
    if (suppressed === this.suppressed) return;
    this.suppressed = suppressed;
    this.sync();
  }

  destroy() {
    this.map.off('zoom', this.sync);
    this.removeAll();
  }

  private add(group: Group, lines: string[], className: string, lngLat: [number, number]) {
    const element = document.createElement('div');
    element.className = `sovereignty-label ${className}`;
    const body = document.createElement('div');
    lines.forEach((line, index) =>
      body.append(
        textElement('span', line),
        ...(index < lines.length - 1 ? [document.createElement('br')] : []),
      ),
    );
    element.append(body);
    const marker = new maplibregl.Marker({ element, anchor: 'center', pitchAlignment: 'viewport' }).setLngLat(
      lngLat,
    );
    this.markers.push({ group, marker });
  }

  private visible(group: Group, zoom: number): boolean {
    if (this.suppressed) return false;
    if (group === 'island') return zoom >= ISLAND_LABEL_MIN_ZOOM;
    if (group === 'sea') return zoom <= EAST_SEA.maxZoom;
    return true;
  }

  private readonly sync = () => {
    // Ngưỡng trong vietnamArchipelagos.ts theo thang zoom của ứng dụng (ô 256 px).
    const zoom = fromGLZoom(this.map.getZoom());
    for (const { group, marker } of this.markers) {
      const show = this.visible(group, zoom);
      const shown = marker.getElement().isConnected;
      if (show && !shown) marker.addTo(this.map);
      else if (!show && shown) marker.remove();
    }
  };

  private removeAll() {
    for (const { marker } of this.markers) marker.remove();
    this.markers = [];
  }
}
