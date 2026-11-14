import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Icon, type IconName } from '../../shared/components/Icon';
import { useMediaQuery } from '../../shared/hooks/useMediaQuery';
import { useShell } from './AppShell';
import { useI18n } from '../../shared/i18n/I18nProvider';

type Snap = 'peek' | 'half' | 'full';
const SNAP_ORDER: Snap[] = ['peek', 'half', 'full'];
const PEEK_PX = 96;
/** Nấc nửa thấp hơn 50% để bản đồ (và tuyến) vẫn nhìn rõ phía trên. */
const HALF_VH = 40;
/** Lề trên mặc định cho nấc đầy; khi banner dẫn đường mở, AppShell thay bằng chiều cao đo được. */
const FULL_TOP_PX = 72;
/** Chiều cao CSS của từng nấc. */
const SNAP_HEIGHT: Record<Snap, string> = {
  peek: `${PEEK_PX}px`,
  half: `${HALF_VH}dvh`,
  full: `calc(100dvh - var(--tab-h) - var(--sheet-top-inset, ${FULL_TOP_PX}px))`,
};
/** Kéo ít hơn ngưỡng này (px) thì coi là chạm, không phải kéo. */
const TAP_THRESHOLD = 5;

type SheetPanelProps = {
  title: string;
  eyebrow?: string;
  icon: IconName;
  onClose: () => void;
  /** Có nút ← bên trái tiêu đề (quay về panel trước). */
  onBack?: () => void;
  /** Vùng cố định ở đáy panel (nút hành động chính). */
  footer?: ReactNode;
  /** Panel đang ẩn nhưng vẫn giữ trạng thái (không nhận phím Esc, không chiếm chỗ). */
  hidden?: boolean;
  children: ReactNode;
};

/**
 * Panel chức năng: desktop/tablet là thẻ kính bên trái, mobile là bottom sheet kéo được
 * với 3 nấc (thu 96px / nửa 40dvh / đầy: sát dưới ô tìm kiếm hoặc banner dẫn đường).
 */
export function SheetPanel({
  title,
  eyebrow,
  icon,
  onClose,
  onBack,
  footer,
  hidden = false,
  children,
}: SheetPanelProps) {
  const { t } = useI18n();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const { setSheet } = useShell();
  const root = useRef<HTMLElement>(null);
  const [snap, setSnap] = useState<Snap>('half');
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const drag = useRef<{
    startY: number;
    startHeight: number;
    minPx: number;
    snaps: number[];
    moved: boolean;
  } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Báo chiều cao bảng cho khung ứng dụng để nút nổi trên bản đồ né lên trên.
  const reportedHeight =
    isMobile && !hidden ? (dragHeight !== null ? `${dragHeight}px` : SNAP_HEIGHT[snap]) : null;
  // Đo vùng bản đồ bị bảng che (không tính transform của animation) để fitBounds chừa chỗ.
  const [inset, setInset] = useState<{ left: number; bottom: number } | null>(null);
  useEffect(() => {
    const element = root.current;
    const parent = element?.offsetParent;
    if (!element || !parent || hidden) {
      setInset(null);
      return;
    }
    const measure = () => {
      const next = {
        left: element.offsetLeft + element.offsetWidth,
        bottom: parent.clientHeight - element.offsetTop,
      };
      setInset((current) =>
        current && current.left === next.left && current.bottom === next.bottom ? current : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [hidden]);
  useEffect(() => {
    setSheet({
      height: reportedHeight,
      isFull: snap === 'full' && dragHeight === null && reportedHeight !== null,
      inset: dragHeight === null ? inset : null,
    });
    return () => setSheet({ height: null, isFull: false, inset: null });
  }, [reportedHeight, snap, dragHeight, inset, setSheet]);

  // Esc đóng panel, trừ khi Esc đó đã dùng để đóng popover / danh sách gợi ý.
  useEffect(() => {
    if (hidden) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if ((event.target as HTMLElement | null)?.closest('[aria-expanded="true"]')) return;
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hidden]);

  const startDrag = (event: PointerEvent<HTMLElement>) => {
    if (!isMobile || !root.current || (event.target as HTMLElement).closest('button, a, input')) return;
    const rect = root.current.getBoundingClientRect();
    const tabHeight = window.innerHeight - rect.bottom;
    const main = root.current.closest('main');
    const configuredTop = main
      ? Number.parseFloat(getComputedStyle(main).getPropertyValue('--sheet-top-inset'))
      : Number.NaN;
    const fullTop = Number.isFinite(configuredTop) && configuredTop > 0 ? configuredTop : FULL_TOP_PX;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      startY: event.clientY,
      startHeight: rect.height,
      minPx: PEEK_PX,
      snaps: [PEEK_PX, (window.innerHeight * HALF_VH) / 100, window.innerHeight - tabHeight - fullTop],
      moved: false,
    };
  };
  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state) return;
    const delta = state.startY - event.clientY;
    if (Math.abs(delta) > TAP_THRESHOLD) state.moved = true;
    if (state.moved) {
      setDragHeight(Math.max(state.minPx, Math.min(state.snaps[2]!, state.startHeight + delta)));
    }
  };
  const endDrag = () => {
    const state = drag.current;
    drag.current = null;
    if (!state) return;
    if (!state.moved) {
      // Chạm vào tay nắm: thu nhỏ → nửa → đầy → thu nhỏ.
      setSnap((current) => SNAP_ORDER[(SNAP_ORDER.indexOf(current) + 1) % SNAP_ORDER.length]!);
      return;
    }
    const final = dragHeight ?? state.startHeight;
    const nearest = state.snaps.reduce(
      (best, value, index) => (Math.abs(value - final) < Math.abs(state.snaps[best]! - final) ? index : best),
      0,
    );
    setSnap(SNAP_ORDER[nearest]!);
    setDragHeight(null);
  };
  const keySnap = (event: KeyboardEvent<HTMLElement>) => {
    const step = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0;
    if (!step || (event.target as HTMLElement).closest('input')) return;
    event.preventDefault();
    setSnap((current) => SNAP_ORDER[Math.max(0, Math.min(2, SNAP_ORDER.indexOf(current) + step))]!);
  };

  return (
    <section
      ref={root}
      aria-label={t(title)}
      style={isMobile ? { height: reportedHeight ?? undefined } : undefined}
      hidden={hidden}
      className={`${hidden ? 'hidden' : 'flex'} absolute z-30 flex-col overflow-hidden bg-white/90 shadow-glass ring-1 ring-black/5 backdrop-blur-xl dark:bg-slate-900/95 dark:text-slate-100 dark:shadow-glass-dark dark:ring-white/10 max-md:inset-x-0 max-md:bottom-[var(--tab-h)] max-md:animate-sheet-up max-md:rounded-t-3xl ${dragHeight === null ? 'max-md:transition-[height] max-md:duration-200' : ''} md:bottom-3 md:left-[80px] md:top-[var(--sheet-top-inset)] md:w-[360px] md:animate-sheet-in md:rounded-3xl lg:left-[88px] lg:w-[400px]`}
    >
      <header
        className="shrink-0 touch-none select-none border-b border-black/5 dark:border-white/10 max-md:cursor-grab"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={keySnap}
      >
        <div
          className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-300 md:hidden dark:bg-slate-600"
          aria-hidden="true"
        />
        <div className="flex items-center gap-2.5 px-4 py-2.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={t('Quay lại')}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-ink-soft transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-brand-500/40"
            >
              <Icon name="arrow-left" size={19} />
            </button>
          )}
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-white shadow-sm">
            <Icon name={icon} size={19} />
          </span>
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="truncate text-[11px] font-bold uppercase tracking-[.08em] text-brand-600 dark:text-brand-300">
                {t(eyebrow)}
              </p>
            )}
            <h2 className="truncate text-base font-bold leading-tight tracking-tight text-ink dark:text-slate-100">
              {t(title)}
            </h2>
          </div>
          <button
            type="button"
            aria-label={t('Đóng bảng')}
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-ink-soft transition hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-brand-500/40"
          >
            <Icon name="close" size={19} />
          </button>
        </div>
      </header>
      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
      {footer && (
        <div className="shrink-0 border-t border-black/5 px-4 py-3 dark:border-white/10">{footer}</div>
      )}
    </section>
  );
}
