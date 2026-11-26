import { stripDiacritics } from '../../../shared/text/stripDiacritics.js';

/** Chữ thường, bỏ dấu, chỉ giữ chữ-số, tách mã đường (DCT9 → dct 9). */
export function normalizePlaceText(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(dct|dt|ql|tl)(\d+)/g, '$1 $2')
    .trim();
}

/**
 * Tên quen gọi của địa danh nổi tiếng → tên VietMap lưu. VietMap không có bí danh nên gõ "Hồ Gươm"
 * chỉ ra các cửa hàng mang tên đó, còn chính cái hồ nằm dưới tên "Hồ Hoàn Kiếm".
 * Khóa đã chuẩn hóa (bỏ dấu, chữ thường); chỉ khớp khi người dùng gõ đúng cả cụm.
 */
const LANDMARK_ALIASES: Record<string, string> = {
  'ho guom': 'Hồ Hoàn Kiếm',
  'ho guom ha noi': 'Hồ Hoàn Kiếm',
  'ho hoan kiem': 'Hồ Hoàn Kiếm',
  'lang bac': 'Lăng Chủ tịch Hồ Chí Minh',
  'lang chu tich': 'Lăng Chủ tịch Hồ Chí Minh',
  'nha tho duc ba': 'Nhà thờ Đức Bà Sài Gòn',
  'buu dien thanh pho': 'Bưu điện Trung tâm Sài Gòn',
  'buu dien sai gon': 'Bưu điện Trung tâm Sài Gòn',
  'dinh doc lap': 'Dinh Độc Lập',
  'hoi truong thong nhat': 'Dinh Độc Lập',
  'pho co hoi an': 'Phố cổ Hội An',
  'chua mot cot': 'Chùa Một Cột',
  'van mieu': 'Văn Miếu Quốc Tử Giám',
  'san bay tan son nhat': 'Sân bay Quốc tế Tân Sơn Nhất',
  'san bay noi bai': 'Sân bay Quốc tế Nội Bài',
  'san bay da nang': 'Sân bay Quốc tế Đà Nẵng',
};

/** Tên VietMap lưu cho một tên quen gọi; `undefined` nếu không phải bí danh (hoặc đã là tên chuẩn). */
export function landmarkAlias(query: string): string | undefined {
  const canonical = LANDMARK_ALIASES[normalizePlaceText(query)];
  if (!canonical || normalizePlaceText(canonical) === normalizePlaceText(query)) return undefined;
  return canonical;
}

/** Tên bắt đầu bằng loại địa danh / nơi công cộng: người tìm "Hồ Gươm" thường muốn những nơi này. */
const LANDMARK_PREFIX =
  /^(ho|cho|cong vien|vuon hoa|pho di bo|quang truong|nha hat|bao tang|den|chua|nha tho|dinh|lang|cau|ben xe|ben tau|ga|san bay|thap|van mieu|hoang thanh|thanh|bai bien|nui|dao|khu du lich)\b/;
/** Tên doanh nghiệp, văn phòng: chỉ nên xuất hiện sau địa danh cùng tên. */
const BUSINESS_PREFIX =
  /^(cong ty|cty|tnhh|phong kinh doanh|van phong|chi nhanh|dai ly|cua hang|shop|tiem|xuong|kho|showroom|trung tam thuong mai|doanh nghiep|tap doan)\b/;

/** +1 địa danh, −1 doanh nghiệp, 0 còn lại. */
export function placeKindScore(name: string): number {
  const n = normalizePlaceText(name);
  if (BUSINESS_PREFIX.test(n)) return -1;
  if (LANDMARK_PREFIX.test(n)) return 1;
  return 0;
}

/** Mức khớp tên: 3 trùng hẳn, 2 câu hỏi là tên + khu vực, 1 tên bắt đầu bằng câu hỏi, 0 còn lại. */
export function nameMatch(query: string, name: string): number {
  const stripRoad = (text: string) => text.replace(/^(duong|pho) /, '');
  const q = stripRoad(normalizePlaceText(query)),
    n = stripRoad(normalizePlaceText(name));
  if (q === n) return 3;
  if (n.split(' ').length >= 2 && q.startsWith(`${n} `)) return 2;
  if (n.startsWith(`${q} `)) return 1;
  return 0;
}

type Ranked = { name: string; address: string };

/**
 * Xếp gợi ý: khớp tên (với câu gõ hoặc tên chuẩn của bí danh) → địa danh trước doanh nghiệp →
 * giữ thứ tự VietMap (đã ưu tiên gần vị trí). Bỏ các dòng trùng tên và địa chỉ.
 */
export function rankPlaceSuggestions<T extends Ranked>(query: string, rows: T[], alias?: string): T[] {
  const match = (name: string) => Math.max(nameMatch(query, name), alias ? nameMatch(alias, name) : 0);
  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    const key = `${normalizePlaceText(row.name)}|${normalizePlaceText(row.address)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique
    .map((row, index) => ({ row, index, match: match(row.name), kind: placeKindScore(row.name) }))
    .sort((a, b) => b.match - a.match || b.kind - a.kind || a.index - b.index)
    .map(({ row }) => row);
}
