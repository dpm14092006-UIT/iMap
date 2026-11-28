import { usableChain, type BasemapProvider } from '../../basemap/providers';
import { VIETNAM_ARCHIPELAGOS } from '../../domain/vietnamArchipelagos';
import { needsTerritoryInset } from '../../domain/vietnamTerritory';
import { EMPTY_COLLECTION, maplibregl, textElement, transformMapRequest, type GLMap } from './gl';
import { VIETNAM_TERRITORY_LNGLAT_BOUNDS } from './MaplibreCamera';
import { fetchVappStyle, rasterStyle } from './MaplibreBasemap';

/**
 * Bản đồ phụ thể hiện toàn vẹn lãnh thổ Việt Nam (Thông tư 17/2018/TT-BTNMT, Điều 20 khoản 2–3).
 * Hiện khi bản đồ chính chỉ thể hiện một phần lãnh thổ; dùng nguồn đã được registry cho phép ở chế độ
 * "overview" (VNSDI hành chính khi có token và được duyệt, nếu không thì vApp), không tự vẽ dữ liệu chủ quyền.
 * Khung đỏ là vùng đang xem; bấm vào để về toàn cảnh Việt Nam.
 */
export class VietnamInset implements maplibregl.IControl {
  private main: GLMap | null = null;
  private inner: GLMap | null = null;
  private box: HTMLButtonElement | null = null;
  private failed = new Set<string>();
  private overlayWatch: MutationObserver | null = null;
  private frame = 0;
  /** Đang dẫn đường từng bước: tạm ẩn bản đồ phụ (chủ dự án phê duyệt 28/11/2026, xem báo cáo chủ quyền). */
  private suspended = false;

  constructor(
    private readonly onOverview: () => void,
    /** Bản đồ phụ không có khung ghi nguồn riêng: ghi nguồn của nó vào khung của bản đồ chính (bắt buộc). */
    private readonly onAttribution: (text: string | null) => void,
    private readonly production: boolean = import.meta.env.PROD,
  ) {}

  onAdd(map: GLMap): HTMLElement {
    this.main = map;
    const box = document.createElement('button');
    box.type = 'button';
    box.className = 'routetwin-territory-inset maplibregl-ctrl';
    box.setAttribute('aria-label', 'Bản đồ phụ toàn vẹn lãnh thổ Việt Nam. Bấm để xem toàn cảnh.');
    box.title = 'Bản đồ phụ: toàn vẹn lãnh thổ Việt Nam';
    const caption = textElement('span', 'Việt Nam');
    caption.className = 'routetwin-territory-inset__caption';
    const host = document.createElement('div');
    host.className = 'routetwin-territory-inset__map';
    box.append(caption, host);
    box.addEventListener('click', (event) => {
      event.stopPropagation();
      this.onOverview();
    });
    this.box = box;
    map.on('moveend', this.sync);
    map.on('resize', this.sync);
    queueMicrotask(this.sync);
    // Đồng hồ tốc độ/thanh dẫn đường xuất hiện hay đổi chỗ, bảng bên phải đóng/mở (data-panel-open), hoặc
    // biến --sheet-top-inset đổi: kiểm tra lại, gộp theo từng khung hình. Bỏ qua phần bên trong khung vẽ
    // (marker đổi transform liên tục khi kéo) và chính bản đồ phụ (nó tự ghi margin).
    const canvasContainer = map.getCanvasContainer();
    this.overlayWatch = new MutationObserver((records) => {
      if (this.frame || !this.box || this.box.hidden) return;
      const own = this.box;
      if (records.every(({ target }) => own.contains(target) || canvasContainer.contains(target))) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.avoidOverlays();
      });
    });
    this.overlayWatch.observe(document.body, { childList: true, subtree: true, attributes: true });
    return box;
  }

  onRemove() {
    this.main?.off('moveend', this.sync);
    this.main?.off('resize', this.sync);
    this.overlayWatch?.disconnect();
    cancelAnimationFrame(this.frame);
    this.onAttribution(null);
    this.inner?.remove();
    this.inner = null;
    this.box?.remove();
    this.box = null;
    this.main = null;
  }

  /**
   * Chỗ bản đồ phụ chiếm (hoặc sẽ chiếm khi xem một phần lãnh thổ), để camera không đặt tuyến khuất sau nó.
   * Đang ẩn thì tạm hiện để đo rồi ẩn lại ngay, trong cùng một lần chạy nên không nhấp nháy.
   */
  footprint(): DOMRect | null {
    const box = this.box;
    if (!box || this.suspended) return null;
    const wasHidden = box.hidden;
    box.hidden = false;
    const rect = box.getBoundingClientRect();
    box.hidden = wasHidden;
    return rect.width > 0 ? rect : null;
  }

  /**
   * Ẩn bản đồ phụ trong lúc dẫn đường từng bước (sau khi bấm "Bắt đầu"); tìm và xem tuyến vẫn có bản đồ phụ.
   */
  setSuspended(suspended: boolean) {
    if (suspended === this.suspended) return;
    this.suspended = suspended;
    this.sync();
  }

  /** Có đang hiển thị bản đồ phụ không (dùng cho kiểm thử, cổng kiểm chứng). */
  isShown(): boolean {
    return Boolean(this.box && !this.box.hidden);
  }

  private readonly sync = () => {
    const main = this.main;
    if (!this.box || !main) return;
    const view = main.getBounds();
    const show =
      !this.suspended &&
      needsTerritoryInset({
        south: view.getSouth(),
        west: view.getWest(),
        north: view.getNorth(),
        east: view.getEast(),
      });
    this.box.hidden = !show;
    main.getContainer().classList.toggle('has-territory-inset', show);
    if (!show) {
      this.onAttribution(null);
      return;
    }
    this.avoidOverlays();
    this.ensureInner();
    const inner = this.inner;
    if (!inner) return;
    inner.resize();
    inner.fitBounds(VIETNAM_TERRITORY_LNGLAT_BOUNDS, { animate: false, padding: 2 });
    // Khung bản đồ phụ thực tế, để cổng kiểm chứng xác nhận phủ đủ 4°30′–23°30′B, 102°–118°Đ.
    const shown = inner.getBounds();
    this.box.dataset.insetBounds = [
      shown.getWest(),
      shown.getSouth(),
      shown.getEast(),
      shown.getNorth(),
    ].join(',');
    this.drawViewport();
  };

  /** Khung đỏ = vùng bản đồ chính đang xem (theo 4 góc màn hình, đúng cả khi bản đồ nghiêng/xoay). */
  private drawViewport() {
    const main = this.main;
    const source = this.inner?.getSource('inset-viewport') as maplibregl.GeoJSONSource | undefined;
    if (!main || !source) return;
    const { clientWidth: w, clientHeight: h } = main.getContainer();
    const corners = [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
      [0, 0],
    ].map(([x, y]) => main.unproject([x!, y!]).toArray());
    source.setData({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: corners },
      properties: {},
    });
  }

  /**
   * Dời bản đồ phụ xuống dưới các phần nổi cùng góc (đồng hồ tốc độ khi dẫn đường, thanh dẫn đường khi nó
   * nằm ở đỉnh), để bản đồ phụ luôn nhìn thấy đủ. Không có vật cản thì dùng khoảng cách mặc định trong CSS.
   */
  private avoidOverlays() {
    const box = this.box;
    const main = this.main;
    if (!box || !main) return;
    box.style.marginTop = '';
    const rect = box.getBoundingClientRect();
    const mapTop = main.getContainer().getBoundingClientRect().top;
    let bottom = 0;
    for (const el of document.querySelectorAll<HTMLElement>('.speedometer, [data-nav-banner]')) {
      if (getComputedStyle(el).visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      const sameColumn = r.left < rect.right && r.right > rect.left;
      const nearTop = r.top < rect.bottom && r.bottom > rect.top - 8;
      if (r.width > 0 && sameColumn && nearTop) bottom = Math.max(bottom, r.bottom);
    }
    if (bottom > 0) box.style.marginTop = `${Math.ceil(bottom - mapTop + 8)}px`;
  }

  private ensureInner() {
    if (this.inner || !this.box) return;
    const host = this.box.querySelector<HTMLElement>('.routetwin-territory-inset__map')!;
    this.inner = new maplibregl.Map({
      container: host,
      interactive: false,
      attributionControl: false,
      bounds: VIETNAM_TERRITORY_LNGLAT_BOUNDS,
      fitBoundsOptions: { padding: 2 },
      fadeDuration: 0,
      transformRequest: transformMapRequest,
      style: { version: 8, sources: {}, layers: [] },
    });
    // Ở tỉ lệ bản đồ phụ, nền có thể lược bớt chữ: luôn ghi tên hai quần đảo (chỉ tên, không vẽ ranh giới).
    for (const archipelago of VIETNAM_ARCHIPELAGOS) {
      const element = document.createElement('div');
      element.className = 'routetwin-territory-inset__label';
      // Hai dòng ("QĐ" / "Hoàng Sa") để không tràn khỏi mép bản đồ phụ.
      element.append(textElement('span', `QĐ\n${archipelago.name.vi.replace('Quần đảo ', '')}`));
      const [lat, lng] = archipelago.label;
      new maplibregl.Marker({ element, anchor: 'center' }).setLngLat([lng, lat]).addTo(this.inner);
    }
    this.inner.on('style.load', () => {
      const inner = this.inner;
      if (!inner || inner.getSource('inset-viewport')) return;
      inner.addSource('inset-viewport', { type: 'geojson', data: EMPTY_COLLECTION });
      inner.addLayer({
        id: 'inset-viewport',
        type: 'line',
        source: 'inset-viewport',
        paint: { 'line-color': '#dc2626', 'line-width': 1.5 },
      });
      this.drawViewport();
    });
    this.showProvider(usableChain('overview', this.production));
  }

  private showProvider(chain: BasemapProvider[]) {
    const inner = this.inner;
    if (!inner) return;
    const [provider, ...rest] = chain.filter((p) => !this.failed.has(p.id));
    if (!provider) {
      this.box?.classList.add('is-unavailable');
      this.onAttribution(null);
      return;
    }
    let ready = false;
    let done = false;
    const fail = () => {
      if (done || this.inner !== inner) return;
      done = true;
      inner.off('error', onError);
      this.failed.add(provider.id);
      this.showProvider(rest);
    };
    const onError = (event: { error?: { status?: number }; sourceId?: string }) => {
      if (event.sourceId === 'inset-viewport') return;
      const status = event.error?.status;
      if (!ready && status !== 404) fail();
    };
    inner.on('error', onError);
    inner.once('idle', () => (ready = true));
    this.onAttribution(provider.attribution);
    if (provider.sourceType !== 'maplibre-style') {
      inner.setStyle(rasterStyle(provider), { diff: false });
      return;
    }
    if (provider.id !== 'vapp') {
      fail();
      return;
    }
    void fetchVappStyle(provider)
      .then((style) => {
        if (this.inner === inner && !done) inner.setStyle(style, { diff: false });
      })
      .catch(fail);
  }
}
