import type { LatLng } from '../../../../shared/geo/types';
import { haversineMeters } from '../../../../shared/geo/distance';
import { VIETNAM_TERRITORY_EXTENT, viewShowsWholeTerritory } from '../../domain/vietnamTerritory';
import type { FitInsets, MapBounds } from '../MapController';
import { fromGLZoom, maplibregl, toGLZoom, type GLMap } from './gl';

/** Độ nghiêng khi bật 3D để xem bản đồ, và khi dẫn đường 3D (nhìn xa phía trước hơn). */
export const VIEW_PITCH_3D = 50;
export const NAV_PITCH_3D = 55;

/** Dưới ngưỡng này (px) là điện thoại: chừa chỗ cho bảng kéo ở đáy. */
export const MOBILE_QUERY = '(max-width: 767px)';

const t = VIETNAM_TERRITORY_EXTENT;
/** Khung toàn vẹn lãnh thổ Điều 20.1 dạng [[tây, nam], [đông, bắc]]. */
export const VIETNAM_TERRITORY_LNGLAT_BOUNDS: [[number, number], [number, number]] = [
  [t.west, t.south],
  [t.east, t.north],
];

/**
 * Điều khiển khung nhìn: bay tới điểm, bám vị trí, zoom vừa các điểm trong phần bản đồ còn thấy
 * (chừa chỗ cho thanh trên, bảng chức năng và cụm nút nổi).
 */
export class MaplibreCamera {
  private fitInsets: FitInsets | null = null;
  private lastFitPoints: LatLng[] | null = null;
  private readonly mobileQuery = window.matchMedia(MOBILE_QUERY);
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  constructor(
    private readonly map: GLMap,
    /** Chỗ bản đồ phụ Điều 20 chiếm trên màn hình (null = không có). */
    private readonly insetFootprint: () => DOMRect | null = () => null,
  ) {}

  /** Toàn cảnh Việt Nam: khớp giới hạn 4°30′–23°30′B, 102°–118°Đ (Điều 20.1), gồm đất liền, đảo, quần đảo. */
  showVietnam() {
    this.map.fitBounds(VIETNAM_TERRITORY_LNGLAT_BOUNDS, { padding: 16, bearing: 0, pitch: 0 });
  }
  zoomIn() {
    this.map.zoomIn();
  }
  zoomOut() {
    this.map.zoomOut();
  }
  /** Mức zoom theo thang của ứng dụng (ô 256 px). */
  getZoom(): number {
    return fromGLZoom(this.map.getZoom());
  }
  getCenter(): LatLng {
    const { lat, lng } = this.map.getCenter();
    return { lat, lng };
  }
  getBounds(): MapBounds {
    const bounds = this.map.getBounds();
    return {
      minLat: Math.max(-90, bounds.getSouth()),
      maxLat: Math.min(90, bounds.getNorth()),
      minLng: Math.max(-180, bounds.getWest()),
      maxLng: Math.min(180, bounds.getEast()),
    };
  }

  flyTo(point: LatLng, zoom = 15) {
    this.map.flyTo({
      center: [point.lng, point.lat],
      zoom: toGLZoom(zoom),
      offset: this.sheetOffset(),
      duration: 550,
    });
  }

  /**
   * Điện thoại: bảng/banner che đáy nên đặt điểm cao hơn tâm khung. Máy tính: bảng bên phải che một phần,
   * dời điểm sang giữa phần bản đồ còn thấy.
   */
  private sheetOffset(): [number, number] {
    if (this.mobileQuery.matches) return [0, -(this.fitInsets?.bottom ?? 0) / 2];
    return [-((this.fitInsets?.right ?? 0) - (this.fitInsets?.left ?? 0)) / 2, 0];
  }

  followLocation(point: LatLng, zoom = 16) {
    const target = { center: [point.lng, point.lat] as [number, number], offset: this.sheetOffset() };
    if (this.getZoom() < zoom) {
      this.map.easeTo({ ...target, zoom: toGLZoom(zoom), duration: 350 });
      return;
    }
    // Không dời khung khi chỉ lệch vài mét (tránh rung bản đồ theo nhiễu GPS).
    const shown = this.map.unproject(
      this.map.project(this.map.getCenter()).add(new maplibregl.Point(...target.offset)),
    );
    if (haversineMeters({ lat: shown.lat, lng: shown.lng }, point) > 25)
      this.map.easeTo({ ...target, duration: 350 });
  }

  /**
   * Bật 3D: nghiêng bản đồ, giữ hướng đang xoay (hoặc về hướng Bắc khi `north`). Tắt 3D: nhìn thẳng từ trên,
   * hướng Bắc lên trên. Một chuyển động duy nhất để không lệnh nào cắt ngang lệnh nào.
   */
  setPitchMode(view3d: boolean, north = !view3d) {
    this.map.easeTo({
      pitch: view3d ? VIEW_PITCH_3D : 0,
      bearing: north ? 0 : this.map.getBearing(),
      duration: this.reducedMotion.matches ? 0 : 600,
    });
  }

  /** Nút la bàn: xoay về hướng Bắc (giữ độ nghiêng). */
  resetNorth() {
    this.map.easeTo({ bearing: 0, duration: this.reducedMotion.matches ? 0 : 400 });
  }

  /** Giảm chuyển động: dẫn đường giữ 2D, hướng Bắc lên trên (không xoay bản đồ liên tục). */
  prefersReducedMotion(): boolean {
    return this.reducedMotion.matches;
  }

  /**
   * Dẫn đường 3D: bản đồ nghiêng, xoay theo hướng đi (hướng đi luôn hướng lên), vị trí đặt thấp trên màn hình
   * để thấy nhiều đường phía trước. Bỏ qua dao động nhỏ của GPS/la bàn để bản đồ không rung.
   */
  /** Bỏ phần đệm do phát lại hành trình để lại (padding của jumpTo được giữ trong camera). */
  clearPadding() {
    this.map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
  }

  /** Phát lại hành trình (4D): đặt camera tức thì mỗi khung hình (không easeTo để khỏi giật). */
  playbackFrame(point: LatLng, zoom: number, heading: number | null) {
    const [, sheetY] = this.sheetOffset();
    const visible = this.map.getContainer().clientHeight + 2 * sheetY;
    this.map.jumpTo({
      center: [point.lng, point.lat],
      zoom: toGLZoom(zoom),
      bearing: heading ?? this.map.getBearing(),
      pitch: heading === null ? this.map.getPitch() : NAV_PITCH_3D,
      // jumpTo không có offset: dời tâm lên trước để mũi tên nằm thấp trên màn hình.
      padding: { top: Math.max(0, sheetY + visible * 0.44), bottom: 0, left: 0, right: 0 },
    });
  }

  followHeading(point: LatLng, zoom: number, heading: number) {
    const [, sheetY] = this.sheetOffset();
    const visible = this.map.getContainer().clientHeight + 2 * sheetY;
    const offset: [number, number] = [0, sheetY + visible * 0.22];
    const turn = Math.abs(((heading - this.map.getBearing() + 540) % 360) - 180);
    const center = this.map.getCenter();
    const moved = haversineMeters({ lat: center.lat, lng: center.lng }, point);
    const steady = Math.abs(this.map.getPitch() - NAV_PITCH_3D) < 1 && this.getZoom() >= zoom;
    if (steady && turn < 3 && moved < 4) return;
    this.map.easeTo({
      center: [point.lng, point.lat],
      zoom: toGLZoom(Math.max(this.getZoom(), zoom)),
      bearing: heading,
      pitch: NAV_PITCH_3D,
      offset,
      duration: 400,
      easing: (t) => t,
    });
  }

  /**
   * Gọi `listener` khi người dùng tự kéo / zoom / xoay / nghiêng bản đồ. Dùng để tạm ngừng bám vị trí lúc dẫn
   * đường cho người dùng xem trước hành trình. Chuyển động do iMap gọi (flyTo, easeTo) không tính.
   */
  onUserGesture(listener: () => void): () => void {
    const byUser = (event: { originalEvent?: unknown }) => {
      if (event.originalEvent) listener();
    };
    // Cuộn chuột và chụm hai ngón báo ngay, không chờ khung hình sau mới có zoomstart.
    const container = this.map.getContainer();
    const onTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) listener();
    };
    const events = ['dragstart', 'zoomstart', 'rotatestart', 'pitchstart', 'dblclick'] as const;
    for (const name of events) this.map.on(name, byUser);
    container.addEventListener('wheel', listener, { passive: true });
    container.addEventListener('touchstart', onTouch, { passive: true });
    return () => {
      for (const name of events) this.map.off(name, byUser);
      container.removeEventListener('wheel', listener);
      container.removeEventListener('touchstart', onTouch);
    };
  }

  /** Báo vùng bị bảng chức năng chiếm (phải ở desktop, đáy ở mobile); null khi không có bảng. */
  setFitInsets(insets: FitInsets | null) {
    this.fitInsets = insets;
  }

  /** Zoom lại vừa vùng vừa fit gần nhất (khi bảng đổi kích thước). */
  refit() {
    if (this.lastFitPoints) this.fit(this.lastFitPoints);
  }

  /**
   * Zoom vừa các điểm trong phần bản đồ còn nhìn thấy: chừa chỗ cho thanh trên (đo thực tế), bảng
   * phải (desktop/tablet) hoặc bảng kéo ở đáy (mobile) và cụm nút nổi bên phải.
   */
  fit(points: LatLng[]) {
    if (!points.length) return;
    this.lastFitPoints = points;
    const container = this.map.getContainer();
    const { clientWidth, clientHeight } = container;
    const wide = clientWidth >= 768;
    const header = container.parentElement?.querySelector('header');
    const headerBottom = header
      ? header.getBoundingClientRect().bottom - container.getBoundingClientRect().top
      : 0;
    let top = Math.max(wide ? 100 : 64, Math.round(headerBottom) + 12);
    let left: number;
    let right: number;
    let bottom: number;
    if (wide) {
      left = (this.fitInsets?.left ?? 0) + 28;
      right = this.fitInsets?.right ? this.fitInsets.right + 24 : 88;
      bottom = 80;
    } else {
      left = 28;
      right = 68; // cụm nút định vị nằm sát mép phải
      bottom = (this.fitInsets ? this.fitInsets.bottom : 0) + 56;
      // Bảng quá cao (nấc đầy): vẫn giữ tối thiểu một dải bản đồ để thấy tuyến.
      bottom = Math.min(bottom, Math.max(48, clientHeight - top - 140));
    }
    // Bản đồ phụ (Điều 20) nằm trên bản đồ ở góc trên phải: không để tuyến/điểm nằm khuất sau nó.
    // Máy tính chừa cột bên phải, điện thoại (hẹp) chừa phía trên.
    // Khung đích chứa trọn lãnh thổ thì bản đồ phụ ẩn, không cần chừa chỗ.
    const lats = points.map((point) => point.lat);
    const lngs = points.map((point) => point.lng);
    const target = {
      south: Math.min(...lats),
      north: Math.max(...lats),
      west: Math.min(...lngs),
      east: Math.max(...lngs),
    };
    const box = viewShowsWholeTerritory(target) ? null : this.insetFootprint();
    if (box) {
      const frame = container.getBoundingClientRect();
      if (wide) right = Math.max(right, Math.round(frame.right - box.left) + 16);
      else {
        top = Math.max(top, Math.round(box.bottom - frame.top) + 12);
        bottom = Math.min(bottom, Math.max(48, clientHeight - top - 140));
      }
    }
    const tooSmall = clientWidth - left - right < 200 || clientHeight - top - bottom < 140;
    const bounds = new maplibregl.LngLatBounds();
    for (const point of points) bounds.extend([point.lng, point.lat]);
    this.map.fitBounds(bounds, {
      padding: tooSmall ? 70 : { top, left, right, bottom },
      maxZoom: toGLZoom(15),
      bearing: this.map.getBearing(),
      pitch: this.map.getPitch(),
    });
  }
}
