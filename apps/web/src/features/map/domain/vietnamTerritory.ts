import type { GeoBounds } from './vietnamArchipelagos';

/**
 * Giới hạn tọa độ để thể hiện toàn vẹn lãnh thổ Việt Nam: 4°30′–23°30′ vĩ Bắc, 102°00′–118°00′ kinh Đông
 * (Thông tư 17/2018/TT-BTNMT, Điều 20 khoản 1; VBHN 103/VBHN-BNNMT ngày 02/11/2026).
 *
 * Đây là KHUNG HIỂN THỊ và KIỂM TRA bản đồ, không phải đường biên giới hay vùng chủ quyền: không dùng để
 * tô màu, cắt dữ liệu hay suy diễn ranh giới.
 */
export const VIETNAM_TERRITORY_EXTENT: GeoBounds = { south: 4.5, west: 102, north: 23.5, east: 118 };

/**
 * Tỉnh, thành có đảo, quần đảo trực thuộc: bản đồ thể hiện toàn bộ hoặc một phần các địa phương này phải có
 * bản đồ phụ thể hiện đảo, quần đảo (Điều 20 khoản 3). Sau sắp xếp đơn vị hành chính 2025: Đà Nẵng (Hoàng Sa),
 * Khánh Hòa (Trường Sa), TP. Hồ Chí Minh (Côn Đảo), An Giang (Phú Quốc, Thổ Chu…).
 */
export const PROVINCES_REQUIRING_ISLAND_INSET = [
  'Đà Nẵng',
  'Khánh Hòa',
  'TP. Hồ Chí Minh',
  'An Giang',
] as const;

/** Khung nhìn chứa trọn giới hạn Điều 20.1 thì đã là bản đồ toàn vẹn lãnh thổ, không cần bản đồ phụ. */
export function viewShowsWholeTerritory(view: GeoBounds): boolean {
  const t = VIETNAM_TERRITORY_EXTENT;
  return view.south <= t.south && view.west <= t.west && view.north >= t.north && view.east >= t.east;
}

/** Khung nhìn có chạm tới khu vực Việt Nam (đất liền, biển, đảo) hay không. */
export function viewTouchesTerritory(view: GeoBounds): boolean {
  const t = VIETNAM_TERRITORY_EXTENT;
  return view.south < t.north && view.north > t.south && view.west < t.east && view.east > t.west;
}

/**
 * Điều 20 khoản 2–3: bản đồ thể hiện một phần lãnh thổ (đất liền liên quan chủ quyền biển, đảo, hoặc
 * Đà Nẵng/Khánh Hòa/TP.HCM/An Giang) phải có bản đồ phụ thể hiện toàn vẹn lãnh thổ. iMap luôn hiện bản đồ phụ
 * toàn vẹn lãnh thổ (gồm Hoàng Sa, Trường Sa, Côn Đảo, Phú Quốc) khi đang xem một phần khu vực Việt Nam.
 */
export function needsTerritoryInset(view: GeoBounds): boolean {
  return viewTouchesTerritory(view) && !viewShowsWholeTerritory(view);
}
