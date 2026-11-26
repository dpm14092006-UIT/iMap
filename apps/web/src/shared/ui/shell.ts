import { createContext, useContext } from 'react';

/** `inset`: phần bản đồ bị bảng che (px, từ mép ngang / mép dưới khung); null khi đang kéo hoặc không có bảng. */
export type SheetState = {
  height: string | null;
  isFull: boolean;
  inset: { left: number; right?: number; bottom: number } | null;
};

export type ShellContextValue = {
  setSheet: (state: SheetState) => void;
  setTopOverlayInset: (inset: number | null) => void;
};

/** Bố cục ứng dụng (AppShell) cung cấp context này; bảng và lớp phủ báo kích thước để nút nổi tự né. */
export const ShellContext = createContext<ShellContextValue>({
  setSheet: () => undefined,
  setTopOverlayInset: () => undefined,
});

/** SheetPanel (mobile) báo chiều cao hiện tại để các nút nổi trên bản đồ tự né lên trên. */
export function useShell() {
  return useContext(ShellContext);
}
