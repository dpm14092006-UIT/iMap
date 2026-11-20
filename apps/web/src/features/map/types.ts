import type { Place } from '../places/types';

/** 'dark' là nền bản đồ tối, tự bật từ 18:00 đến 06:00 (xem useTimeBasedMapLayer). */
export type MapLayer = 'street' | 'satellite' | 'dark';

/** Điểm đi/đến đã chọn nhưng chưa tính tuyến, vẫn hiển thị marker A/B trên bản đồ. */
export type DraftStops = {
  origin: Place | null;
  destination: Place | null;
  /** Địa điểm đang xem chi tiết (từ ô tìm kiếm / bấm bản đồ), vẽ ghim riêng kể cả khi có tuyến. */
  focus?: Place | null;
};

/** Công tắc các lớp phủ trên bản đồ. */
export type MapOverlays = { traffic: boolean; incidents: boolean; terrain: boolean };
