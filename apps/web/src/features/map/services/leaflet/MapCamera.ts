import * as L from 'leaflet';
import type { LatLng } from '../../../../shared/geo/types';
import { MOBILE_QUERY, VIETNAM_CENTER } from './drawing';

/** Vùng bản đồ bị giao diện nổi che (px, tính từ mép khung bản đồ). */
export type FitInsets = { left: number; bottom: number };

/**
 * Điều khiển khung nhìn: bay tới điểm, bám vị trí, zoom vừa các điểm trong phần bản đồ còn thấy
 * (chừa chỗ cho thanh trên, bảng chức năng và cụm nút nổi).
 */
export class MapCamera {
  private fitInsets: FitInsets | null = null;
  private lastFitPoints: L.LatLngExpression[] | null = null;
  private readonly mobileQuery = window.matchMedia(MOBILE_QUERY);

  constructor(private readonly map: L.Map) {}

  showVietnam() {
    this.map.setView(VIETNAM_CENTER, 5);
  }
  zoomIn() {
    this.map.zoomIn();
  }
  zoomOut() {
    this.map.zoomOut();
  }
  getZoom(): number {
    return this.map.getZoom();
  }
  getCenter(): LatLng {
    const point = this.map.getCenter();
    return { lat: point.lat, lng: point.lng };
  }
  getBounds() {
    const bounds = this.map.getBounds();
    return {
      minLat: Math.max(-90, bounds.getSouth()),
      maxLat: Math.min(90, bounds.getNorth()),
      minLng: Math.max(-180, bounds.getWest()),
      maxLng: Math.min(180, bounds.getEast()),
    };
  }

  flyTo(point: LatLng, zoom = 15) {
    this.map.flyTo(this.centerAboveSheet(L.latLng(point.lat, point.lng), zoom), zoom, { duration: 0.55 });
  }

  /** Điện thoại: bảng/banner che đáy nên dời tâm xuống để điểm nằm giữa phần bản đồ còn thấy. */
  private centerAboveSheet(target: L.LatLng, zoom: number): L.LatLng {
    const covered = this.mobileQuery.matches ? (this.fitInsets?.bottom ?? 0) : 0;
    if (covered <= 0) return target;
    return this.map.unproject(this.map.project(target, zoom).add([0, covered / 2]), zoom);
  }

  followLocation(point: LatLng, zoom = 16) {
    const target = this.centerAboveSheet(L.latLng(point.lat, point.lng), Math.max(this.map.getZoom(), zoom));
    if (this.map.getZoom() < zoom) this.map.setView(target, zoom, { animate: true, duration: 0.35 });
    else if (this.map.getCenter().distanceTo(target) > 25)
      this.map.panTo(target, { animate: true, duration: 0.35 });
  }

  /**
   * Gọi `listener` khi người dùng tự kéo / zoom bản đồ (kéo, cuộn chuột, chụm 2 ngón, chạm đúp).
   * Dùng để tạm ngừng bám vị trí lúc dẫn đường cho người dùng xem trước hành trình.
   */
  onUserGesture(listener: () => void): () => void {
    const container = this.map.getContainer();
    const onTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) listener();
    };
    this.map.on('dragstart dblclick', listener);
    container.addEventListener('wheel', listener, { passive: true });
    container.addEventListener('touchstart', onTouch, { passive: true });
    return () => {
      this.map.off('dragstart dblclick', listener);
      container.removeEventListener('wheel', listener);
      container.removeEventListener('touchstart', onTouch);
    };
  }

  /** Báo vùng bị bảng chức năng chiếm (trái ở desktop, đáy ở mobile); null khi không có bảng. */
  setFitInsets(insets: FitInsets | null) {
    this.fitInsets = insets;
  }

  /** Zoom lại vừa vùng vừa fit gần nhất (khi bảng đổi kích thước). */
  refit() {
    if (this.lastFitPoints) this.fit(this.lastFitPoints);
  }

  /**
   * Zoom vừa các điểm trong phần bản đồ còn nhìn thấy: chừa chỗ cho thanh trên (đo thực tế), bảng
   * trái (desktop/tablet, rộng 360-400px) hoặc bảng kéo ở đáy (mobile) và cụm nút nổi bên phải.
   */
  fit(points: L.LatLngExpression[]) {
    this.lastFitPoints = points;
    const container = this.map.getContainer();
    const { clientWidth, clientHeight } = container;
    const wide = clientWidth >= 768;
    const header = container.parentElement?.querySelector('header');
    const headerBottom = header
      ? header.getBoundingClientRect().bottom - container.getBoundingClientRect().top
      : 0;
    const top = Math.max(wide ? 100 : 64, Math.round(headerBottom) + 12);
    let left: number;
    let right: number;
    let bottom: number;
    if (wide) {
      left = this.fitInsets ? this.fitInsets.left + 24 : clientWidth >= 1024 ? 510 : 460;
      right = 90;
      bottom = 80;
    } else {
      left = 28;
      right = 68; // cụm nút định vị / Việt Nam nằm sát mép phải
      bottom = (this.fitInsets ? this.fitInsets.bottom : 0) + 56; // chừa chỗ cho nút Lớp và cụm nút nổi
      // Bảng quá cao (nấc đầy): vẫn giữ tối thiểu một dải bản đồ để thấy tuyến.
      bottom = Math.min(bottom, Math.max(48, clientHeight - top - 140));
    }
    const tooSmall = clientWidth - left - right < 200 || clientHeight - top - bottom < 140;
    this.map.fitBounds(L.latLngBounds(points), {
      ...(tooSmall
        ? { padding: [70, 70] }
        : { paddingTopLeft: [left, top], paddingBottomRight: [right, bottom] }),
      maxZoom: 15,
    });
  }
}
