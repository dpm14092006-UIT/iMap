import * as L from 'leaflet';
import type { MapLayer } from '../../types';
import { usableChain, type BasemapMode, type BasemapProvider } from '../../basemap/providers';

/** Đường dẫn "api:/..." trong registry đi qua proxy của API iMap (giữ khóa/token ở máy chủ). */
export function resolveProviderUrl(url: string): string {
  if (!url.startsWith('api:')) return url;
  const api = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
  return `${api}${url.slice('api:'.length)}`;
}

export function rasterLayer(provider: BasemapProvider) {
  return L.tileLayer(resolveProviderUrl(provider.url), {
    attribution: provider.attribution,
    minNativeZoom: provider.zoom?.min,
    maxNativeZoom: provider.zoom?.max ?? 18,
    maxZoom: 19,
    className: `routetwin-basemap-${provider.id}`,
  });
}

/** Thông báo khi không còn nguồn nền nào hợp lệ (IMAP V2 §6: không dự phòng về OSM). */
class BasemapNotice extends L.Control {
  constructor(private readonly production: boolean) {
    super({ position: 'topright' });
  }
  override onAdd() {
    const box = L.DomUtil.create('div', 'routetwin-basemap-notice');
    box.setAttribute('role', 'status');
    box.textContent = this.production
      ? 'Bản đồ nền tạm thời không khả dụng: chưa có nguồn bản đồ được phê duyệt. Tuyến đường và địa điểm vẫn dùng được.'
      : 'Bản đồ nền tạm thời không khả dụng: các nguồn đang kiểm thử đều không phản hồi. Tuyến đường và địa điểm vẫn dùng được.';
    return box;
  }
}

/**
 * BasemapManager trên Leaflet: chọn nguồn theo BasemapRegistry (features/map/basemap/providers.ts).
 * Production chỉ dùng nguồn APPROVED; dev dùng thêm TESTING. Nguồn lỗi trong phiên thì thử nguồn tiếp theo.
 * Nhãn chủ quyền Hoàng Sa, Trường Sa, Biển Đông của iMap do ArchipelagoLabels vẽ trên mọi nền.
 */
export class BaseLayers {
  private active: { provider: BasemapProvider; layer: L.Layer } | null = null;
  private current: string | undefined;
  private revision = 0;
  private readonly failed = new Set<string>();
  private notice: BasemapNotice | null = null;
  private shown: BasemapProvider | null = null;

  constructor(
    private readonly map: L.Map,
    private readonly production: boolean = import.meta.env.PROD,
    /** Báo nguồn đang hiển thị (null = không có nền), để lớp nhãn chủ quyền của iMap bật/tắt theo. */
    private readonly onProviderChange: (provider: BasemapProvider | null) => void = () => {},
  ) {
    this.apply('street', false);
  }

  apply(layer: MapLayer, terrain: boolean) {
    const container = this.map.getContainer();
    container.classList.toggle('map-theme-dark', layer === 'dark');
    container.classList.toggle('map-theme-satellite', layer === 'satellite');
    container.classList.toggle('map-theme-admin', layer === 'admin');

    // Lớp phủ Địa hình chỉ thay nền khi có nguồn địa hình hợp lệ; nếu không, giữ nền đang chọn.
    const wantsTerrain =
      terrain && layer !== 'satellite' && usableChain('terrain', this.production).length > 0;
    const mode: BasemapMode = wantsTerrain ? 'terrain' : layer;
    if (mode === this.current) return;
    this.current = mode;
    const revision = ++this.revision;
    this.clearLayer();
    this.setNotice(false);
    this.showFirstAvailable(usableChain(mode, this.production), layer, revision);
  }

  /** Nguồn đang được chọn để hiển thị (kể cả khi đang tải). */
  currentProvider(): BasemapProvider | null {
    return this.shown;
  }

  /** Nguồn đang hiển thị (dùng cho kiểm thử, cổng kiểm chứng và chẩn đoán). */
  activeProviderId(): string | null {
    return this.active?.provider.id ?? null;
  }

  destroy() {
    this.revision++;
    this.clearLayer();
    this.setNotice(false);
  }

  private showFirstAvailable(chain: BasemapProvider[], layer: MapLayer, revision: number) {
    if (revision !== this.revision) return;
    const [provider, ...rest] = chain.filter((p) => !this.failed.has(p.id));
    if (!provider) {
      this.setNotice(true);
      this.shown = null;
      this.onProviderChange(null);
      return;
    }
    this.map.getContainer().dataset.basemap = provider.id;
    this.shown = provider;
    this.onProviderChange(provider);
    let failed = false;
    const fail = () => {
      if (failed || revision !== this.revision) return;
      failed = true;
      this.failed.add(provider.id);
      this.clearLayer();
      this.showFirstAvailable(rest, layer, revision);
    };

    if (provider.sourceType !== 'maplibre-style') {
      const tiles = rasterLayer(provider);
      let loaded = false;
      tiles.once('tileload', () => {
        loaded = true;
      });
      // Ô đầu tiên đã lỗi (thiếu token, máy chủ bận) thì coi như nguồn không dùng được trong phiên này.
      tiles.on('tileerror', () => {
        if (!loaded) fail();
      });
      this.active = { provider, layer: tiles.addTo(this.map) };
      return;
    }

    const load =
      provider.id === 'vapp'
        ? import('./VappLayer').then(({ addVappLayer }) => addVappLayer(this.map, provider, fail))
        : import('./VietmapLayer').then(({ addVietmapLayer }) =>
            addVietmapLayer(this.map, layer === 'admin' ? 'street' : layer, fail),
          );
    void load
      .then((gl) => {
        if (failed || revision !== this.revision) {
          this.map.removeLayer(gl);
          return;
        }
        this.active = { provider, layer: gl };
      })
      .catch(fail);
  }

  private setNotice(show: boolean) {
    if (show && !this.notice) this.notice = new BasemapNotice(this.production).addTo(this.map);
    if (!show && this.notice) {
      this.notice.remove();
      this.notice = null;
    }
  }

  private clearLayer() {
    if (this.active) this.map.removeLayer(this.active.layer);
    this.active = null;
    delete this.map.getContainer().dataset.basemap;
  }
}
