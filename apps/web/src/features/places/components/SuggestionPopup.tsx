import { useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { fitPopupHeight } from '../domain/popupFit';

/** Vị trí mặc định: ngay dưới ô nhập, rộng bằng ô nhập. */
export const DEFAULT_SUGGESTION_POSITION = 'absolute left-0 right-0 top-[calc(100%+7px)]';

type SuggestionPopupProps = {
  /** Lớp định vị (thay cho mặc định), vd. ô tìm kiếm trên cùng cho danh sách rộng hết màn hình điện thoại. */
  positionClassName?: string | undefined;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'children'>;

/** Phần tử cuộn gần nhất chứa danh sách (vd. thân panel Chỉ đường), hoặc null nếu là cả trang. */
function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = window.getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
  }
  return null;
}

/**
 * Khung danh sách gợi ý. Chiều cao tối đa được tính theo khoảng trống thật bên dưới ô nhập, trong
 * vùng cuộn đang chứa nó, nên trên màn hình thấp danh sách không bị nút ở chân panel ("Tìm đường") che;
 * khi gần như không còn chỗ thì cuộn panel để danh sách hiện ra.
 */
export function SuggestionPopup({ positionClassName, children, ...rest }: SuggestionPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const popup = ref.current;
    if (!popup) return;
    const container = scrollParent(popup);
    const fit = () => {
      const { maxHeight, needsScroll } = fitPopupHeight({
        popupTop: popup.getBoundingClientRect().top,
        containerBottom: container?.getBoundingClientRect().bottom ?? window.innerHeight,
        viewportHeight: window.innerHeight,
      });
      popup.style.maxHeight = `${maxHeight}px`;
      // jsdom và trình duyệt rất cũ không có scrollIntoView.
      if (needsScroll) popup.scrollIntoView?.({ block: 'nearest' });
    };
    fit();
    window.addEventListener('resize', fit);
    container?.addEventListener('scroll', fit, { passive: true });
    return () => {
      window.removeEventListener('resize', fit);
      container?.removeEventListener('scroll', fit);
    };
  }, []);
  return (
    <div
      ref={ref}
      className={`${positionClassName ?? DEFAULT_SUGGESTION_POSITION} z-[80] max-h-[min(60dvh,560px)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-100 bg-white p-1.5 shadow-float dark:shadow-float-dark dark:border-white/10 dark:bg-slate-800`}
      {...rest}
    >
      {children}
    </div>
  );
}
