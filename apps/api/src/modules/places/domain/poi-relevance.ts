import { stripDiacritics } from '../../../shared/text/strip-diacritics.js';

/** Chuẩn hóa NFC, chữ thường, gộp khoảng trắng; vẫn giữ dấu tiếng Việt. */
export function foldCase(value: string): string {
  return value.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

const words = (value: string) => value.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * Tên địa điểm có liên quan tới từ khóa tự do không? VietMap tìm không phân biệt dấu nên "phở" trả cả
 * "Khu Phố 3". Quy tắc: mỗi từ của truy vấn phải mở đầu một từ trong TÊN (không xét địa chỉ).
 * Từ có dấu thì so khớp có dấu ("phở" ≠ "phố"); từ không dấu so sau khi bỏ dấu cả hai phía
 * ("pho" khớp cả "phở" và "phố").
 */
export function matchesQueryName(name: string, query: string): boolean {
  const tokens = words(foldCase(query));
  if (tokens.length === 0) return true;
  const nameWords = words(foldCase(name));
  const plainNameWords = nameWords.map(stripDiacritics);
  return tokens.every((token) => {
    const plain = stripDiacritics(token);
    return plain === token
      ? plainNameWords.some((word) => word.startsWith(token))
      : nameWords.some((word) => word.startsWith(token));
  });
}
