/** Bỏ dấu tiếng Việt (đ → d), chữ thường, cắt khoảng trắng đầu/cuối: "Bến Thành" → "ben thanh". */
export function foldVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}
