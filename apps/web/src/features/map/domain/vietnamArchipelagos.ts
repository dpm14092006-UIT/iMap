import type { Language } from '../../../shared/i18n/translate';

/** Nhãn chủ quyền biển đảo Việt Nam được hiển thị trên mọi lớp nền. */
type LocalizedName = Record<Language, string>;

export type GeoBounds = { south: number; west: number; north: number; east: number };

export type Archipelago = {
  id: 'hoang-sa' | 'truong-sa';
  name: LocalizedName;
  /** Vị trí đặt nhãn quần đảo [vĩ độ, kinh độ]. */
  label: [number, number];
  /** Vùng bao toàn bộ đảo, đá, bãi của quần đảo. */
  bounds: GeoBounds;
};

export type ArchipelagoIsland = { name: LocalizedName; lat: number; lng: number };

/** Tên nước hiển thị dưới tên quần đảo. */
export const SOVEREIGN_NAME: LocalizedName = { vi: 'Việt Nam', en: 'Viet Nam' };

export const VIETNAM_ARCHIPELAGOS: readonly Archipelago[] = [
  {
    id: 'hoang-sa',
    name: { vi: 'Quần đảo Hoàng Sa', en: 'Hoang Sa Archipelago' },
    label: [16.25, 112.05],
    bounds: { south: 15.2, west: 110.7, north: 17.6, east: 113.3 },
  },
  {
    id: 'truong-sa',
    name: { vi: 'Quần đảo Trường Sa', en: 'Truong Sa Archipelago' },
    label: [9.6, 114.0],
    bounds: { south: 5.9, west: 111.2, north: 12.3, east: 118.1 },
  },
];

/** Tên biển Việt Nam, hiện ở mức zoom thấp trên mọi lớp nền (cổng kiểm chứng chủ quyền kiểm tra tên này). */
export const EAST_SEA = {
  name: { vi: 'Biển Đông', en: 'East Sea' } satisfies LocalizedName,
  label: [13.2, 115.6] as [number, number],
  maxZoom: 8,
};

/** Một số đảo tiêu biểu, chỉ hiện khi đã zoom gần (xem ISLAND_LABEL_MIN_ZOOM). */
export const VIETNAM_ISLANDS: readonly ArchipelagoIsland[] = [
  // Hoàng Sa (thành phố Đà Nẵng)
  { name: { vi: 'Đảo Phú Lâm', en: 'Phu Lam Island' }, lat: 16.834, lng: 112.338 },
  { name: { vi: 'Đảo Cây', en: 'Cay Island' }, lat: 16.98, lng: 112.271 },
  { name: { vi: 'Đảo Linh Côn', en: 'Linh Con Island' }, lat: 16.667, lng: 112.733 },
  { name: { vi: 'Đảo Hoàng Sa', en: 'Hoang Sa Island' }, lat: 16.533, lng: 111.608 },
  { name: { vi: 'Đảo Quang Hòa', en: 'Quang Hoa Island' }, lat: 16.45, lng: 111.708 },
  { name: { vi: 'Đảo Tri Tôn', en: 'Tri Ton Island' }, lat: 15.783, lng: 111.2 },
  // Trường Sa (tỉnh Khánh Hòa)
  { name: { vi: 'Đảo Song Tử Tây', en: 'Song Tu Tay Island' }, lat: 11.429, lng: 114.331 },
  { name: { vi: 'Đảo Thị Tứ', en: 'Thi Tu Island' }, lat: 11.055, lng: 114.284 },
  { name: { vi: 'Đảo Loại Ta', en: 'Loai Ta Island' }, lat: 10.668, lng: 114.423 },
  { name: { vi: 'Đảo Ba Bình', en: 'Ba Binh Island' }, lat: 10.377, lng: 114.365 },
  { name: { vi: 'Đảo Sơn Ca', en: 'Son Ca Island' }, lat: 10.376, lng: 114.478 },
  { name: { vi: 'Đảo Nam Yết', en: 'Nam Yet Island' }, lat: 10.181, lng: 114.361 },
  { name: { vi: 'Đảo Sinh Tồn', en: 'Sinh Ton Island' }, lat: 9.884, lng: 114.329 },
  { name: { vi: 'Đảo Trường Sa', en: 'Truong Sa Island' }, lat: 8.644, lng: 111.92 },
  { name: { vi: 'Đảo An Bang', en: 'An Bang Island' }, lat: 7.892, lng: 112.917 },
];

export const ISLAND_LABEL_MIN_ZOOM = 9;
