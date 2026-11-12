/**
 * Chế độ Demo (GPS giả) chỉ bật khi mở app với tham số `?demo=1`, ví dụ http://localhost:5173/?demo=1.
 * Người dùng bình thường chỉ thấy chế độ Thật.
 */
export function isDemoModeEnabled(search: string = window.location.search): boolean {
  return new URLSearchParams(search).get('demo') === '1';
}
