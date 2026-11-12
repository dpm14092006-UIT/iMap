/** Bỏ dấu tiếng Việt (kể cả đ/Đ → d/D); giữ nguyên hoa/thường. Dùng chung để so khớp không dấu. */
export function stripDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFC');
}
