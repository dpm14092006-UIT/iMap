import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ShellContext, type SheetState } from '../../shared/ui/shell';

type AppShellProps = {
  /** Bật class `dark` cho toàn bộ giao diện (theo giao diện hệ thống hoặc lựa chọn của người dùng, xem useMapAppearance). */
  dark: boolean;
  /** Báo mỗi khi bảng đổi kích thước (để zoom lại tuyến vừa phần bản đồ còn thấy). */
  onSheetChange?: (state: SheetState) => void;
  map: ReactNode;
  topBar: ReactNode;
  /** Nút góc dưới trái: bộ chọn lớp, chú giải giao thông… */
  bottomLeft: ReactNode;
  /** Cụm điều khiển bản đồ góc dưới phải. */
  bottomRight: ReactNode;
  /** Panel, banner, toast… định vị tuyệt đối theo khung này. */
  children: ReactNode;
};

/** Khung ứng dụng: bản đồ nền + các lớp giao diện nổi, tự lo vị trí theo dock / bảng kéo. */
export function AppShell({
  dark,
  onSheetChange,
  map,
  topBar,
  bottomLeft,
  bottomRight,
  children,
}: AppShellProps) {
  const [sheet, setSheet] = useState<SheetState>({ height: null, isFull: false, inset: null });
  const [topOverlayInset, setTopOverlayInset] = useState<number | null>(null);
  const context = useMemo(() => ({ setSheet, setTopOverlayInset }), []);
  const style = {
    ...(sheet.height ? { '--sheet-h': sheet.height } : {}),
    '--sheet-top-inset': topOverlayInset === null ? '72px' : `${topOverlayInset}px`,
  } as CSSProperties;
  useEffect(() => {
    onSheetChange?.(sheet);
  }, [sheet, onSheetChange]);
  // Có bảng kéo (mobile): cụm nút nổi hạ xuống sát mép trên bảng cho gọn.
  const docked = sheet.height !== null;
  const hideOnFullSheet = sheet.isFull ? 'max-md:hidden' : '';

  return (
    <ShellContext.Provider value={context}>
      <main
        id="map"
        style={style}
        data-panel-open={sheet.inset ? 'true' : undefined}
        data-sheet={sheet.isFull ? 'full' : undefined}
        className={`${dark ? 'dark' : ''} relative h-[100dvh] overflow-hidden bg-surface-muted text-content`}
      >
        {map}
        {topBar}
        <div
          className={`pointer-events-none absolute bottom-[calc(var(--shell-bottom)+24px)] right-[76px] max-md:right-[60px] ${docked ? 'max-md:bottom-[calc(var(--shell-bottom)+12px)]' : ''} z-20 flex flex-wrap items-end gap-2 transition-[bottom] duration-200 left-3 ${hideOnFullSheet} [&>*]:pointer-events-auto`}
        >
          {bottomLeft}
        </div>
        <div
          data-map-controls
          className={`absolute bottom-[var(--map-controls-bottom)] right-3 z-20 flex flex-col items-end gap-2 [--map-controls-bottom:calc(var(--shell-bottom)+10px)] transition-[bottom] duration-200 ${docked ? 'max-md:[--map-controls-bottom:calc(var(--shell-bottom)+12px)]' : ''} ${hideOnFullSheet}`}
        >
          {bottomRight}
        </div>
        {children}
      </main>
    </ShellContext.Provider>
  );
}
