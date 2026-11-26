/** Chiều cao tối đa của danh sách gợi ý (khớp max-h-[min(60dvh,560px)] trong CSS). */
const MAX_POPUP_PX = 560;
/** Thấp hơn mức này thì danh sách quá chật: cuộn panel để có thêm chỗ thay vì thu nhỏ tiếp. */
export const MIN_POPUP_PX = 180;
/** Khoảng hở với mép dưới vùng nhìn thấy. */
const BOTTOM_GAP_PX = 8;

export type PopupFitInput = {
  /** Mép trên của danh sách (px, theo khung nhìn). */
  popupTop: number;
  /** Mép dưới của vùng cuộn chứa danh sách (vd. thân panel, ngay trên nút "Tìm đường"). */
  containerBottom: number;
  viewportHeight: number;
};

/** Chiều cao tối đa để danh sách nằm gọn trong phần nhìn thấy của panel; cờ cuộn khi quá chật. */
export function fitPopupHeight({ popupTop, containerBottom, viewportHeight }: PopupFitInput): {
  maxHeight: number;
  needsScroll: boolean;
} {
  const visibleBottom = Math.min(containerBottom, viewportHeight);
  const available = Math.floor(visibleBottom - popupTop - BOTTOM_GAP_PX);
  const cap = Math.min(MAX_POPUP_PX, Math.floor(viewportHeight * 0.6));
  if (available >= MIN_POPUP_PX) return { maxHeight: Math.min(cap, available), needsScroll: false };
  return { maxHeight: Math.min(cap, MIN_POPUP_PX), needsScroll: true };
}
