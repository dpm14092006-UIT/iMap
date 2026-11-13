/**
 * Định dạng đơn vị hiển thị.
 * Quy ước dự án: server trả mét/giây, frontend mới đổi sang km/phút.
 */

/** 850 -> "850 m", 12345 -> "12,3 km" */
export function formatDistanceMeters(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`;
}

/** 12.34 -> "12,3 km" */
export function formatDistanceKm(km: number): string {
  return formatDistanceMeters(km * 1000);
}

/** 45 -> "45 phút", 135 -> "2 giờ 15 phút" */
export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
}

/** 45 -> "45 ph", 135 -> "2h15", dùng ở chỗ hẹp như thẻ phương tiện. */
export function formatDurationShort(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} ph`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return `${hours}h${String(rest).padStart(2, '0')}`;
}

/** 47 -> "47 ph", 125 -> "2h05": nhãn gọn trên bản đồ điện thoại (cùng kiểu với thẻ phương tiện). */
export function formatDurationCompact(minutes: number): string {
  const total = Math.max(1, Math.round(minutes));
  if (total < 60) return `${total} ph`;
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`;
}
