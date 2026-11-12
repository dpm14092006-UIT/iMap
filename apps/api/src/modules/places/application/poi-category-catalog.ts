import type { PoiCategory } from '@routetwin/shared';

export type PoiCategorySearchTerm = {
  /** Từ khóa tiếng Việt gửi làm `text` (autocomplete khớp theo tên). */
  keyword: string;
  /** Mã danh mục VietMap đã quan sát thật; thiếu mã thì chỉ tìm theo từ khóa, không đoán. */
  categoryCodes: readonly string[];
};

/** Mã quan sát được ngày 12/11/2026: 10009 xăng, 2001 khách sạn, 10013/6000 trạm sạc, 1001 cà phê, 1002/1005 nhà hàng, quán ăn. */
export const poiCategorySearchTerms: Record<PoiCategory, PoiCategorySearchTerm> = {
  restaurant: { keyword: 'nhà hàng', categoryCodes: ['1002', '1005'] },
  cafe: { keyword: 'cà phê', categoryCodes: ['1001', '1001-1'] },
  hotel: { keyword: 'khách sạn', categoryCodes: ['2001'] },
  attraction: { keyword: 'công viên', categoryCodes: [] },
  museum: { keyword: 'bảo tàng', categoryCodes: [] },
  bus: { keyword: 'trạm xe buýt', categoryCodes: [] },
  pharmacy: { keyword: 'nhà thuốc', categoryCodes: [] },
  atm: { keyword: 'ATM', categoryCodes: [] },
  fuel: { keyword: 'xăng', categoryCodes: ['10009'] },
  ev: { keyword: 'trạm sạc', categoryCodes: ['10013', '6000'] },
};

/** Đoán danh mục từ mã VietMap của một kết quả (null nếu không khớp danh mục nào). */
export function categoryFromCodes(codes: readonly string[], hint?: PoiCategory): PoiCategory | null {
  if (hint) return hint;
  for (const [category, term] of Object.entries(poiCategorySearchTerms) as [
    PoiCategory,
    PoiCategorySearchTerm,
  ][]) {
    if (term.categoryCodes.some((code) => codes.includes(code))) return category;
  }
  return null;
}
