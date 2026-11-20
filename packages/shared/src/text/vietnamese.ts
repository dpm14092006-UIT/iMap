/** Remove Vietnamese diacritics, including đ/Đ, while preserving letter case. */
export function stripDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFC');
}

/** Canonical search key: accent insensitive, lowercase, with leading/trailing whitespace removed. */
export function foldVietnamese(value: string): string {
  return stripDiacritics(value).toLowerCase().trim();
}
