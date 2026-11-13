import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

/** `inset`: phần bản đồ bị bảng che (px, từ mép trái / mép dưới khung); null khi đang kéo hoặc không có bảng. */
export type SheetState = {
  height: string | null;
  isFull: boolean;
  inset: { left: number; bottom: number } | null;
};
type ShellContextValue = { setSheet: (state: SheetState) => void };

const ShellContext = createContext<ShellContextValue>({ setSheet: () => undefined });

/** SheetPanel (mobile) báo chiều cao hiện tại để các nút nổi trên bản đồ tự né lên trên. */
export function useShell() {
  return useContext(ShellContext);
}

type AppShellProps = {
  /** Bật class `dark` cho toàn bộ giao diện (theo giờ, xem useTimeBasedMapLayer). */
  dark: boolean;
  /** Báo mỗi khi bảng đổi kích thước (để zoom lại tuyến vừa phần bản đồ còn thấy). */
  onSheetChange?: (state: SheetState) => void;
  /** Có panel mở: nhóm nút góc dưới trái dịch sang phải để không bị panel che. */
  panelOpen: boolean;
  map: ReactNode;
  dock: ReactNode;
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
  panelOpen,
  map,
  dock,
  topBar,
  bottomLeft,
  bottomRight,
  children,
}: AppShellProps) {
  const [sheet, setSheet] = useState<SheetState>({ height: null, isFull: false, inset: null });
  const context = useMemo(() => ({ setSheet }), []);
  const style = sheet.height ? ({ '--sheet-h': sheet.height } as CSSProperties) : undefined;
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
        className={`${dark ? 'dark' : ''} relative h-[100dvh] min-h-[560px] overflow-hidden bg-[#e8ece7] text-ink dark:bg-[#05070b] dark:text-slate-100`}
      >
        {map}
        {dock}
        {topBar}
        <div
          className={`pointer-events-none absolute bottom-[calc(var(--shell-bottom)+24px)] right-[76px] max-md:right-[60px] ${docked ? 'max-md:bottom-[calc(var(--shell-bottom)+12px)]' : ''} z-20 flex flex-wrap items-end gap-2 transition-[left,bottom] duration-200 max-md:left-3 ${panelOpen ? 'md:left-[452px] lg:left-[500px]' : 'md:left-[80px] lg:left-[88px]'} ${hideOnFullSheet} [&>*]:pointer-events-auto`}
        >
          {bottomLeft}
        </div>
        <div
          className={`absolute bottom-[calc(var(--shell-bottom)+56px)] right-3 z-20 transition-[bottom] duration-200 ${docked ? 'max-md:bottom-[calc(var(--shell-bottom)+34px)]' : ''} ${hideOnFullSheet}`}
        >
          {bottomRight}
        </div>
        {children}
      </main>
    </ShellContext.Provider>
  );
}
