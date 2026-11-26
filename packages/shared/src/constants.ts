/** Hằng số thuần (không phụ thuộc zod) để web import mà không kéo cả bộ schema vào bundle. */

/** Giới hạn số điểm cho tối ưu hóa hành trình (Held–Karp chính xác). */
export const MAX_OPTIMIZE_POINTS = 16;

export const stopCategories = [
  'fuel',
  'cafe',
  'restaurant',
  'pharmacy',
  'atm',
  'toilets',
  'school',
  'hospital',
  'parking',
  'park',
  'library',
  'bus_stop',
  'train_station',
  'rest_area',
] as const;
export type StopCategory = (typeof stopCategories)[number];
export const stopCategoryLabels: Record<StopCategory, string> = {
  fuel: 'Trạm xăng',
  cafe: 'Cà phê',
  restaurant: 'Quán ăn',
  pharmacy: 'Nhà thuốc',
  atm: 'ATM',
  toilets: 'Nhà vệ sinh',
  school: 'Trường học',
  hospital: 'Bệnh viện',
  parking: 'Bãi đỗ xe',
  park: 'Công viên',
  library: 'Thư viện',
  bus_stop: 'Trạm xe buýt',
  train_station: 'Ga tàu',
  rest_area: 'Trạm nghỉ',
};

/**
 * Vùng VietMap tính được tuyến/địa điểm (chính VietMap báo trong lỗi "out of bounds").
 * Điểm ngoài vùng bị từ chối ngay ở API, không tốn lượt gọi VietMap.
 */
export const VIETMAP_COVERAGE = {
  minLat: 8.452657,
  maxLat: 23.370086,
  minLng: 102.147222,
  maxLng: 112.219631,
} as const;

/** Một lần tải báo cáo giao thông chỉ được phủ tối đa chừng này độ mỗi chiều (RPC Postgres cũng chặn). */
export const MAX_TRAFFIC_BOUNDS_SPAN_DEG = 2;

/** Điểm có nằm trong vùng VietMap hỗ trợ không. */
export function isInVietmapCoverage(point: { lat: number; lng: number }): boolean {
  return (
    point.lat >= VIETMAP_COVERAGE.minLat &&
    point.lat <= VIETMAP_COVERAGE.maxLat &&
    point.lng >= VIETMAP_COVERAGE.minLng &&
    point.lng <= VIETMAP_COVERAGE.maxLng
  );
}
