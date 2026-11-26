import type { Place } from '../places/types';

/**
 * Kiểu nền bản đồ. Chế độ tự động theo giao diện hệ thống.
 * street/dark/satellite: Vietmap; admin: bản đồ hành chính nhà nước VNSDI.
 */
export type MapLayer = 'street' | 'satellite' | 'dark' | 'admin';

/** Điểm đi/đến đã chọn nhưng chưa tính tuyến, vẫn hiển thị marker A/B trên bản đồ. */
export type DraftStops = {
  origin: Place | null;
  destination: Place | null;
  /** Địa điểm đang xem chi tiết (từ ô tìm kiếm / bấm bản đồ), vẽ ghim riêng kể cả khi có tuyến. */
  focus?: Place | null;
};

/** Công tắc các lớp phủ trên bản đồ. */
export type MapOverlays = { traffic: boolean; incidents: boolean; terrain: boolean };
