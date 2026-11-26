import type { StyleSpecification } from 'maplibre-gl';
import { usableChain, type BasemapMode, type BasemapProvider } from '../../basemap/providers';
import type { MapLayer } from '../../types';
import { vietmapProxyBase, type GLMap } from './gl';

export const VAPP_ORIGIN = 'https://map.vapp.vn';
const BACKGROUND = '#e8ece7';
const VIETMAP_STYLES: Record<Exclude<MapLayer, 'admin'>, string> = {
  street: 'tm',
  dark: 'dm',
  satellite: 'hm',
};

/** Đường dẫn "api:/..." trong registry đi qua proxy của API iMap (giữ khóa/token ở máy chủ). */
export function resolveProviderUrl(url: string): string {
  if (!url.startsWith('api:')) return url;
  const api = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
  const path = `${api}${url.slice('api:'.length)}`;
  // MapLibre tải ô trong worker: cần địa chỉ tuyệt đối.
  return new URL(path, window.location.origin).href.replace(/%7B/g, '{').replace(/%7D/g, '}');
}

/** Style tối thiểu cho nguồn ô ảnh (VNSDI ArcGIS): một lớp raster trên nền màu trung tính. */
export function rasterStyle(provider: BasemapProvider): StyleSpecification {
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: [resolveProviderUrl(provider.url)],
        tileSize: 256,
        minzoom: provider.zoom?.min ?? 0,
        maxzoom: provider.zoom?.max ?? 18,
      },
    },
    layers: [
      { id: 'basemap-background', type: 'background', paint: { 'background-color': BACKGROUND } },
      { id: 'basemap', type: 'raster', source: 'basemap' },
    ],
  };
}

const EMPTY_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'basemap-background', type: 'background', paint: { 'background-color': BACKGROUND } }],
};

/** Tải style vApp và dùng NGUYÊN BẢN: không ẩn, không đổi màu lớp nào (kể cả lớp chủ quyền sov-*). */
export async function fetchVappStyle(
  provider: BasemapProvider,
  request: typeof fetch = fetch,
): Promise<StyleSpecification> {
  if (!provider.url.startsWith(`${VAPP_ORIGIN}/`)) throw new Error('Nguồn vApp không hợp lệ');
  const response = await request(provider.url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`vApp style HTTP ${response.status}`);
  return (await response.json()) as StyleSpecification;
}

type Attempt = {
  revision: number;
  provider: BasemapProvider;
  /** Style của nguồn này đã nạp (sự kiện trước đó thuộc style cũ). */
  styleLoaded: boolean;
  ready: boolean;
  fail: () => void;
};

/**
 * BasemapManager trên MapLibre GL: chọn nguồn theo BasemapRegistry (features/map/basemap/providers.ts).
 * Production chỉ dùng nguồn APPROVED; dev dùng thêm TESTING. Nguồn lỗi trong phiên thì thử nguồn tiếp theo;
 * hết nguồn thì hiện thông báo, không bao giờ quay về OpenStreetMap (IMAP V2 §6).
 */
export class MaplibreBasemap {
  private current: string | undefined;
  private revision = 0;
  private readonly failed = new Set<string>();
  private attempt: Attempt | null = null;
  private shown: BasemapProvider | null = null;
  private notice: HTMLElement | null = null;

  constructor(
    private readonly map: GLMap,
    private readonly production: boolean = import.meta.env.PROD,
    /** Báo nguồn đang hiển thị (null = không có nền): nhãn chủ quyền, ghi nguồn bật/tắt theo. */
    private readonly onProviderChange: (provider: BasemapProvider | null) => void = () => {},
    private readonly request: typeof fetch = fetch,
  ) {
    map.on('error', this.onError);
    map.on('style.load', this.onStyleLoad);
    map.on('idle', this.onIdle);
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
    this.setNotice(false);
    this.showFirstAvailable(usableChain(mode, this.production), layer, revision);
  }

  /** Nguồn đang được chọn để hiển thị (kể cả khi đang tải). */
  currentProvider(): BasemapProvider | null {
    return this.shown;
  }

  /** Nguồn đã tải xong và đang hiển thị (dùng cho kiểm thử, cổng kiểm chứng và chẩn đoán). */
  activeProviderId(): string | null {
    return this.attempt?.ready ? this.attempt.provider.id : null;
  }

  destroy() {
    this.revision++;
    this.map.off('error', this.onError);
    this.map.off('style.load', this.onStyleLoad);
    this.map.off('idle', this.onIdle);
    this.setNotice(false);
  }

  private showFirstAvailable(chain: BasemapProvider[], layer: MapLayer, revision: number) {
    if (revision !== this.revision) return;
    const container = this.map.getContainer();
    const [provider, ...rest] = chain.filter((p) => !this.failed.has(p.id));
    if (!provider) {
      this.attempt = null;
      this.shown = null;
      delete container.dataset.basemap;
      this.onProviderChange(null);
      this.map.setStyle(EMPTY_STYLE, { diff: false });
      this.setNotice(true);
      return;
    }
    container.dataset.basemap = provider.id;
    this.shown = provider;
    this.onProviderChange(provider);
    const attempt: Attempt = {
      revision,
      provider,
      styleLoaded: false,
      ready: false,
      fail: () => {
        if (this.attempt !== attempt || revision !== this.revision) return;
        this.failed.add(provider.id);
        this.attempt = null;
        this.showFirstAvailable(rest, layer, revision);
      },
    };
    this.attempt = attempt;

    if (provider.sourceType !== 'maplibre-style') {
      this.map.setStyle(rasterStyle(provider), { diff: false });
      return;
    }
    if (provider.id === 'vapp') {
      void fetchVappStyle(provider, this.request)
        .then((style) => {
          if (this.attempt === attempt) this.map.setStyle(style, { diff: false });
        })
        .catch(attempt.fail);
      return;
    }
    const style = VIETMAP_STYLES[layer === 'admin' ? 'street' : layer];
    this.map.setStyle(new URL(`styles/${style}/style.json`, vietmapProxyBase()).href, { diff: false });
  }

  private readonly onStyleLoad = () => {
    if (this.attempt) this.attempt.styleLoaded = true;
    this.map.getContainer().classList.toggle('has-basemap', Boolean(this.attempt));
  };

  private readonly onIdle = () => {
    if (this.attempt?.styleLoaded) this.attempt.ready = true;
  };

  private readonly onError = (event: {
    error: Error & { status?: number; url?: string };
    sourceId?: string;
  }) => {
    const attempt = this.attempt;
    // Lỗi từ nguồn iMap tự vẽ (tuyến, giao thông…) không liên quan nền. Yêu cầu bị hủy khi đổi style, hay
    // lỗi của nguồn thuộc style cũ (đã gỡ), cũng không phải lỗi của nguồn đang thử.
    if (!attempt || event.sourceId?.startsWith('rt-') || event.error?.name === 'AbortError') return;
    if (event.sourceId && (!attempt.styleLoaded || !this.map.getSource(event.sourceId))) return;
    const status = event.error?.status;
    const url = event.error?.url ?? '';
    const emptyTile = status === 404 && (url.includes('/tile') || attempt.provider.id === 'vapp');
    // Ảnh ô (VNSDI): chỉ ô đầu tiên lỗi mới bỏ nguồn (thiếu token, máy chủ bận); ô lẻ lỗi sau đó bỏ qua.
    // Vector (vApp, Vietmap): bị từ chối/hết hạn mức/máy chủ lỗi lúc nào cũng chuyển nguồn; ô lẻ 404
    // (vùng biển trống) là bình thường; mọi lỗi khác trước khi tải xong cũng chuyển nguồn.
    const rejected =
      status !== undefined &&
      attempt.provider.sourceType === 'maplibre-style' &&
      ([401, 403, 423].includes(status) || status >= 429);
    if (rejected || (!attempt.ready && !emptyTile)) queueMicrotask(attempt.fail);
  };

  private setNotice(show: boolean) {
    if (show && !this.notice) {
      const box = document.createElement('div');
      box.className = 'routetwin-basemap-notice';
      box.setAttribute('role', 'status');
      box.textContent = this.production
        ? 'Bản đồ nền tạm thời không khả dụng: chưa có nguồn bản đồ được phê duyệt. Tuyến đường và địa điểm vẫn dùng được.'
        : 'Bản đồ nền tạm thời không khả dụng: các nguồn đang kiểm thử đều không phản hồi. Tuyến đường và địa điểm vẫn dùng được.';
      this.map.getContainer().querySelector('.maplibregl-ctrl-top-right')?.prepend(box);
      this.notice = box;
    }
    if (!show && this.notice) {
      this.notice.remove();
      this.notice = null;
    }
  }
}
