import type { IconName } from '../../../shared/components/Icon';
import type { PoiCategory, PoiSearchTerm } from '../types';

export type PoiCategoryMeta = {
  label: string;
  icon: IconName;
  /** Màu nhận diện của chip và marker trên bản đồ. */
  color: string;
  /** Cách gọi khác (không dấu); khớp nguyên cụm thì ô tìm kiếm dùng danh mục thay vì từ khóa tự do. */
  aliases: string[];
};

export const poiCatalog: Record<PoiCategory, PoiCategoryMeta> = {
  restaurant: {
    label: 'Nhà hàng',
    icon: 'restaurant',
    color: '#ea580c',
    aliases: ['nha hang', 'quan an', 'an uong'],
  },
  cafe: { label: 'Cà phê', icon: 'cafe', color: '#b45309', aliases: ['ca phe', 'cafe', 'coffee'] },
  hotel: { label: 'Khách sạn', icon: 'hotel', color: '#4338ca', aliases: ['khach san', 'hotel', 'nha nghi'] },
  attraction: {
    label: 'Điểm tham quan',
    icon: 'attraction',
    color: '#059669',
    aliases: ['tham quan', 'diem tham quan', 'du lich', 'cong vien'],
  },
  museum: { label: 'Bảo tàng', icon: 'museum', color: '#7c3aed', aliases: ['bao tang', 'museum'] },
  bus: {
    label: 'Trạm xe buýt',
    icon: 'bus',
    color: '#0891b2',
    aliases: ['xe buyt', 'tram buyt', 'tram xe buyt', 'bus'],
  },
  pharmacy: { label: 'Nhà thuốc', icon: 'pharmacy', color: '#16a34a', aliases: ['nha thuoc', 'pharmacy'] },
  atm: { label: 'ATM', icon: 'atm', color: '#0d9488', aliases: ['atm', 'cay atm'] },
  fuel: {
    label: 'Xăng',
    icon: 'fuel',
    color: '#dc2626',
    aliases: ['xang', 'tram xang', 'cay xang', 'do xang'],
  },
  ev: {
    label: 'Sạc EV',
    icon: 'ev',
    color: '#2563eb',
    aliases: ['sac', 'tram sac', 'sac xe dien', 'tram sac xe dien', 'ev'],
  },
};

/** Địa điểm tìm bằng từ khóa tự do (không thuộc danh mục nào). */
export const genericPoiMeta: Pick<PoiCategoryMeta, 'label' | 'icon' | 'color'> = {
  label: 'Địa điểm',
  icon: 'pin',
  color: '#475569',
};

export const poiCategoryOrder: PoiCategory[] = [
  'restaurant',
  'cafe',
  'hotel',
  'attraction',
  'museum',
  'bus',
  'pharmacy',
  'atm',
  'fuel',
  'ev',
];

/** Các danh mục gợi ý khi tìm dọc tuyến. */
export const alongRouteCategories: PoiCategory[] = ['fuel', 'ev', 'restaurant', 'cafe', 'hotel'];

export function poiMetaFor(category: PoiCategory | null) {
  return category ? poiCatalog[category] : genericPoiMeta;
}

function stripDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Khớp nguyên cụm với tên hoặc cách gọi khác của danh mục ("xăng", "ca phe"); còn lại là từ khóa tự do. */
export function findPoiCategory(text: string): PoiCategory | null {
  const normalized = stripDiacritics(text);
  if (!normalized) return null;
  return (
    poiCategoryOrder.find(
      (category) =>
        stripDiacritics(poiCatalog[category].label) === normalized ||
        poiCatalog[category].aliases.includes(normalized),
    ) ?? null
  );
}

/** Chữ người dùng gõ -> điều kiện tìm: danh mục nếu khớp, ngược lại gửi nguyên văn. Rỗng thì null. */
export function termFromText(text: string): PoiSearchTerm | null {
  const query = text.trim().replace(/\s+/g, ' ');
  if (!query) return null;
  const category = findPoiCategory(query);
  return category ? { category } : { query };
}

/** Nhãn hiển thị của điều kiện tìm: tên danh mục hoặc “từ khóa”. */
export function termLabel(term: PoiSearchTerm): string {
  if (term.query) return `“${term.query}”`;
  return term.category ? poiCatalog[term.category].label : 'Địa điểm';
}

export function sameTerm(a: PoiSearchTerm, b: PoiSearchTerm): boolean {
  return a.category === b.category && a.query === b.query;
}
