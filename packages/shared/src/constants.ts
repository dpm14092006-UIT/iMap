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
