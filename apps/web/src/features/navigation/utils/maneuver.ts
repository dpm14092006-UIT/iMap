/**
 * Đổi mã `sign` trong hướng dẫn rẽ của VietMap (chuẩn GraphHopper) thành ký hiệu mũi tên.
 * Tham khảo: -3 rẽ gắt trái … 0 đi thẳng … 3 rẽ gắt phải, 4 đến nơi, 6 vòng xuyến.
 */
const SIGN_ARROWS: Record<number, string> = {
  [-98]: '↶', // quay đầu
  [-8]: '↶', // quay đầu bên trái
  [-7]: '↖', // đi về làn trái
  [-3]: '↰', // rẽ gắt trái
  [-2]: '↰', // rẽ trái
  [-1]: '↖', // chếch trái
  0: '↑', // đi thẳng
  1: '↗', // chếch phải
  2: '↱', // rẽ phải
  3: '↱', // rẽ gắt phải
  4: '⚑', // đã đến nơi
  5: '•', // qua điểm dừng
  6: '⟳', // vòng xuyến
  7: '↗', // đi về làn phải
  8: '↷', // quay đầu bên phải
};

/** Mũi tên cho một bước chỉ dẫn; không rõ mã thì coi như đi thẳng. */
export function maneuverArrow(sign: number | undefined): string {
  return sign === undefined ? '↑' : SIGN_ARROWS[sign] ?? '↑';
}
