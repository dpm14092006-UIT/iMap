import * as L from 'leaflet';
import { usableChain, type BasemapProvider } from '../../basemap/providers';
import { needsTerritoryInset, VIETNAM_TERRITORY_EXTENT } from '../../domain/vietnamTerritory';
import { rasterLayer } from './BaseLayers';
import { textElement } from './drawing';
import { VIETNAM_ARCHIPELAGOS } from '../../domain/vietnamArchipelagos';

const t = VIETNAM_TERRITORY_EXTENT;
export const VIETNAM_TERRITORY_BOUNDS = L.latLngBounds([t.south, t.west], [t.north, t.east]);

const toBounds = (b: L.LatLngBounds) => ({
  south: b.getSouth(),
  west: b.getWest(),
  north: b.getNorth(),
  east: b.getEast(),
});

/**
 * Bản đồ phụ thể hiện toàn vẹn lãnh thổ Việt Nam (Thông tư 17/2018/TT-BTNMT, Điều 20 khoản 2–3).
 * Hiện khi bản đồ chính chỉ thể hiện một phần lãnh thổ; dùng nguồn đã được registry cho phép ở chế độ
 * "overview" (VNSDI hành chính khi có token và được duyệt, nếu không thì vApp), không tự vẽ dữ liệu chủ quyền.
 * Khung đỏ là vùng đang xem; bấm vào để về toàn cảnh Việt Nam.
 */
export class VietnamInset extends L.Control {
  private inner: L.Map | null = null;
  private viewport: L.Rectangle | null = null;
  private box: HTMLElement | null = null;
  private attribution: string | null = null;
  private failed = new Set<string>();

  constructor(
    private readonly main: L.Map,
    private readonly onOverview: () => void,
    private readonly production: boolean = import.meta.env.PROD,
  ) {
    super({ position: 'topright' });
  }

  override onAdd() {
    const box = L.DomUtil.create('button', 'routetwin-territory-inset');
    box.type = 'button';
    box.setAttribute('aria-label', 'Bản đồ phụ toàn vẹn lãnh thổ Việt Nam. Bấm để xem toàn cảnh.');
    box.title = 'Bản đồ phụ: toàn vẹn lãnh thổ Việt Nam';
    const caption = L.DomUtil.create('span', 'routetwin-territory-inset__caption', box);
    caption.textContent = 'Việt Nam';
    L.DomUtil.create('div', 'routetwin-territory-inset__map', box);
    L.DomEvent.disableClickPropagation(box);
    L.DomEvent.disableScrollPropagation(box);
    L.DomEvent.on(box, 'click', () => this.onOverview());
    this.box = box;
    this.main.on('moveend zoomend resize', this.sync);
    queueMicrotask(this.sync);
    return box;
  }

  override onRemove() {
    this.main.off('moveend zoomend resize', this.sync);
    this.setAttribution(null);
    this.inner?.remove();
    this.inner = null;
    this.box = null;
  }

  /** Có đang hiển thị bản đồ phụ không (dùng cho kiểm thử, cổng kiểm chứng). */
  isShown(): boolean {
    return Boolean(this.box && !this.box.hidden);
  }

  private readonly sync = () => {
    if (!this.box) return;
    const show = needsTerritoryInset(toBounds(this.main.getBounds()));
    this.box.hidden = !show;
    this.main.getContainer().classList.toggle('has-territory-inset', show);
    if (!show) {
      this.setAttribution(null);
      return;
    }
    this.ensureInner();
    this.inner?.invalidateSize();
    this.inner?.fitBounds(VIETNAM_TERRITORY_BOUNDS, { animate: false, padding: [2, 2] });
    // Khung bản đồ phụ thực tế, để cổng kiểm chứng xác nhận phủ đủ 4°30′–23°30′B, 102°–118°Đ.
    if (this.inner) this.box.dataset.insetBounds = this.inner.getBounds().toBBoxString();
    const view = this.main.getBounds();
    if (this.viewport) this.viewport.setBounds(view);
    else if (this.inner)
      this.viewport = L.rectangle(view, {
        color: '#dc2626',
        weight: 1.5,
        fill: false,
        interactive: false,
      }).addTo(this.inner);
  };

  private ensureInner() {
    if (this.inner || !this.box) return;
    const host = this.box.querySelector<HTMLElement>('.routetwin-territory-inset__map')!;
    this.inner = L.map(host, {
      attributionControl: false,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      zoomSnap: 0.1,
      minZoom: 1,
    });
    this.inner.fitBounds(VIETNAM_TERRITORY_BOUNDS, { animate: false, padding: [2, 2] });
    // Ở tỉ lệ bản đồ phụ, nền có thể lược bớt chữ: luôn ghi tên hai quần đảo (chỉ tên, không vẽ ranh giới).
    for (const archipelago of VIETNAM_ARCHIPELAGOS) {
      const label = document.createElement('div');
      // Hai dòng ("QĐ" / "Hoàng Sa") để không tràn khỏi mép bản đồ phụ.
      label.append(textElement('span', `QĐ\n${archipelago.name.vi.replace('Quần đảo ', '')}`));
      L.marker(archipelago.label, {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({ className: 'routetwin-territory-inset__label', html: label, iconSize: [0, 0] }),
      }).addTo(this.inner);
    }
    this.showProvider(usableChain('overview', this.production));
  }

  private showProvider(chain: BasemapProvider[]) {
    const inner = this.inner;
    if (!inner) return;
    const [provider, ...rest] = chain.filter((p) => !this.failed.has(p.id));
    if (!provider) {
      this.box?.classList.add('is-unavailable');
      this.setAttribution(null);
      return;
    }
    const fail = () => {
      this.failed.add(provider.id);
      this.showProvider(rest);
    };
    // Bản đồ phụ không có khung ghi nguồn riêng: ghi nguồn của nó vào khung của bản đồ chính (bắt buộc).
    this.setAttribution(provider.attribution);
    if (provider.sourceType !== 'maplibre-style') {
      const tiles = rasterLayer(provider);
      let loaded = false;
      tiles.once('tileload', () => (loaded = true));
      tiles.on('tileerror', () => {
        if (!loaded) {
          inner.removeLayer(tiles);
          fail();
        }
      });
      tiles.addTo(inner);
      return;
    }
    if (provider.id !== 'vapp') {
      fail();
      return;
    }
    void import('./VappLayer').then(({ addVappLayer }) => addVappLayer(inner, provider, fail)).catch(fail);
  }

  private setAttribution(text: string | null) {
    const control = this.main.attributionControl;
    if (this.attribution && control) control.removeAttribution(this.attribution);
    this.attribution = text;
    if (text && control) control.addAttribution(text);
  }
}
