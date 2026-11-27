import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { MapController } from '../../../features/map/services/MapController';
import type { LatLng } from '../../../shared/geo/types';
import type { SheetState } from '../../../shared/ui/shell';

/** Chờ hiệu ứng đổi chiều cao bảng (200 ms) xong rồi mới zoom lại tuyến. */
const REFIT_AFTER_SHEET_MS = 260;
/** Bảng không báo chiều cao (desktop, bảng đã mở sẵn) thì vẫn bay tới điểm sau khoảng này. */
const FOCUS_FALLBACK_MS = 400;

/**
 * Phối hợp bản đồ với bảng chức năng: bay tới điểm sau khi bảng vừa mở đã báo chiều cao (để điểm không
 * nằm khuất sau bảng trên điện thoại) và zoom lại tuyến vừa phần bản đồ còn thấy khi bảng đổi kích thước.
 *
 * @param routeFitActive Có đang xem một tuyến cần giữ vừa khung không.
 */
export function useMapViewport(mapController: RefObject<MapController | null>, routeFitActive: boolean) {
  const pendingFocus = useRef<{ point: LatLng; zoom: number | undefined } | null>(null);
  const sheetOpen = useRef(false);
  const routeFitActiveRef = useRef(routeFitActive);
  routeFitActiveRef.current = routeFitActive;
  const lastSheetInset = useRef<SheetState['inset']>(null);
  const sheetFitTimer = useRef<number | undefined>(undefined);
  const focusTimer = useRef<number | undefined>(undefined);

  const flushFocus = useCallback(() => {
    window.clearTimeout(focusTimer.current);
    const pending = pendingFocus.current;
    pendingFocus.current = null;
    if (pending) mapController.current?.flyTo(pending.point, pending.zoom);
  }, [mapController]);

  const focusAfterPanel = (point: LatLng, zoom?: number) => {
    window.clearTimeout(focusTimer.current);
    pendingFocus.current = { point, zoom };
    if (sheetOpen.current) flushFocus();
    else focusTimer.current = window.setTimeout(flushFocus, FOCUS_FALLBACK_MS);
  };

  /** Bảng đổi kích thước (đổi nấc kéo, mở/đóng panel): báo cho bản đồ, chỉ zoom lại khi đã dừng kéo. */
  const handleSheetChange = useCallback(
    (sheet: SheetState) => {
      const controller = mapController.current;
      if (!controller) return;
      controller.setFitInsets(sheet.inset);
      sheetOpen.current = sheet.inset !== null;
      if (sheet.inset) flushFocus();
      const previous = lastSheetInset.current;
      if (!sheet.inset) return;
      lastSheetInset.current = sheet.inset;
      if (
        previous &&
        previous.left === sheet.inset.left &&
        previous.right === sheet.inset.right &&
        previous.bottom === sheet.inset.bottom
      )
        return;
      window.clearTimeout(sheetFitTimer.current);
      sheetFitTimer.current = window.setTimeout(() => {
        if (routeFitActiveRef.current) mapController.current?.refit();
      }, REFIT_AFTER_SHEET_MS);
    },
    [flushFocus, mapController],
  );
  useEffect(
    () => () => {
      window.clearTimeout(sheetFitTimer.current);
      window.clearTimeout(focusTimer.current);
      pendingFocus.current = null;
    },
    [],
  );

  return { focusAfterPanel, handleSheetChange };
}
