import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Popover } from '../../../shared/ui/Popover';
import { Icon } from '../../../shared/ui/Icon';
import { useI18n } from '../../../shared/i18n/I18nProvider';
import type { MapLayer, MapOverlays } from '../types';
import type { MapLayerPreference } from '../hooks/useMapAppearance';
import { usableChain, usableSourceCredits } from '../basemap/providers';

/** Đơn vị nguồn nền dùng được trong bản build này (production: chỉ nguồn đã duyệt). */
const SOURCE_CREDITS = usableSourceCredits(import.meta.env.PROD).join(' · ');

type LayerSwitcherProps = {
  layer: MapLayer;
  preference: MapLayerPreference;
  inMenu?: boolean;
  overlays: MapOverlays;
  onLayerChange: (layer: MapLayerPreference) => void;
  onOverlaysChange: (overlays: MapOverlays) => void;
  /**
   * Nút nằm ở góc nào của bản đồ. Popover mở về phía còn trống:
   * 'left' (mặc định) mở sang phải, 'right' mở sang trái để không tràn khỏi mép màn hình.
   */
  align?: 'left' | 'right';
};

const baseOptions = [
  { id: 'auto', label: 'Theo hệ thống', icon: 'compass' },
  { id: 'street', label: 'Đường phố', icon: 'road' },
  { id: 'dark', label: 'Tối', icon: 'moon' },
  { id: 'satellite', label: 'Vệ tinh', icon: 'layers' },
  { id: 'admin', label: 'Hành chính', icon: 'globe' },
] as const;

const overlayOptions: { key: keyof MapOverlays; label: string; hint: string }[] = [
  { key: 'traffic', label: 'Giao thông trực tiếp', hint: 'Quầng màu quanh sự cố và đoạn tắc trên tuyến' },
  { key: 'incidents', label: 'Sự cố cộng đồng', hint: 'Marker kẹt xe, tai nạn, ngập…' },
  { key: 'terrain', label: 'Địa hình', hint: 'Bản đồ địa hình VNSDI (không dùng với nền Vệ tinh)' },
];

/** Nút thẻ ảnh "Lớp" (góc dưới trái, hoặc dưới phải khi đang dẫn đường); mở popover chọn nền bản đồ và các lớp phủ. */
export function LayerSwitcher({
  layer,
  preference,
  inMenu = false,
  overlays,
  onLayerChange,
  onOverlaysChange,
  align = 'left',
}: LayerSwitcherProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Mở về phía còn nhiều chỗ hơn (trên/dưới nút) và giới hạn chiều cao theo khoảng trống thật:
  // khi dẫn đường trên màn hình thấp, bảng điều hướng đẩy nút lên cao nên phía trên có thể rất hẹp.
  const [placement, setPlacement] = useState<{ above: boolean; maxHeight: number; lift: number } | null>(
    null,
  );
  useLayoutEffect(() => {
    if (!open || inMenu) return;
    let last = '';
    const measure = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const gap = 8 + 8; // khoảng cách tới nút + lề màn hình
      // Thanh dẫn đường nằm trên lớp của menu: menu không được mở đè lên nó (sẽ che mất công tắc).
      // Thanh có thể ở dưới nút, ở đỉnh màn hình (khi đang mở một bảng) hoặc đè một phần lên chính nút.
      const banner = document.querySelector('[data-nav-banner]')?.getBoundingClientRect();
      const overlapsTrigger = banner && banner.top < rect.bottom && banner.bottom > rect.top;
      // Mép dưới mà menu mở lên phải nằm phía trên: nút, hoặc mép trên của thanh nếu thanh đè lên nút.
      const anchorTop = overlapsTrigger ? Math.min(rect.top, banner.top) : rect.top;
      const topLimit = banner && banner.bottom <= rect.top ? banner.bottom : 0;
      const bottomLimit = banner && banner.top >= rect.bottom ? banner.top : window.innerHeight;
      const spaceAbove = anchorTop - topLimit - gap;
      const spaceBelow = overlapsTrigger ? 0 : bottomLimit - rect.bottom - gap;
      const above = spaceAbove >= 320 || spaceAbove >= spaceBelow;
      const next = {
        above,
        maxHeight: Math.max(120, Math.floor(above ? spaceAbove : spaceBelow)),
        lift: above ? Math.max(0, Math.round(rect.top - anchorTop)) : 0,
      };
      const key = JSON.stringify(next);
      if (key !== last) {
        last = key;
        setPlacement(next);
      }
    };
    // Đo lại mỗi khung hình khi menu đang mở: khi dẫn đường, thanh điều hướng và cụm nút bản đồ còn dịch
    // chuyển (đổi chiều cao, đổi chỗ đỉnh/đáy) sau lúc menu mở. Chỉ cập nhật khi số đo thay đổi.
    let frame = 0;
    const loop = () => {
      measure();
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frame);
  }, [open, inMenu]);
  const titleId = useId();
  const base = layer === 'satellite' ? 'satellite' : 'street';
  // Khi dẫn đường, trừ cột nút bản đồ và các khoảng cách đến mép màn hình.
  const panelPosition =
    align === 'right'
      ? 'right-0 max-w-[calc(100vw-4.75rem)] max-md:max-w-[calc(100vw-4.5rem)]'
      : 'left-0 max-w-[calc(100vw-32px)]';

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      label={t('Lớp bản đồ')}
      className="[--layer-trigger-size:2.75rem]"
      panelClassName={
        inMenu
          ? '!static !mb-2 !bg-surface-muted !shadow-none'
          : `${placement && !placement.above ? 'top-full mt-2' : 'bottom-full mb-2'} w-[280px] overflow-y-auto !border !border-line !bg-surface ${panelPosition}`
      }
      panelStyle={
        !inMenu && placement
          ? {
              maxHeight: placement.maxHeight,
              ...(placement.lift ? { marginBottom: placement.lift + 8 } : {}),
            }
          : undefined
      }
      trigger={
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-label={t('Lớp bản đồ')}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={
            inMenu
              ? 'ui-button ui-button-ghost min-h-11 w-full justify-start gap-3 px-3 text-sm'
              : 'ui-button ui-button-secondary h-11 w-11 p-0 shadow-glass'
          }
        >
          <Icon name="layers" size={20} />
          {inMenu && (
            <>
              {t('Lớp bản đồ')}
              <Icon name="chevron-down" size={16} className="ml-auto" />
            </>
          )}
        </button>
      }
    >
      <p id={titleId} className="mb-2 text-xs font-bold text-content">
        {t('Loại bản đồ')}
      </p>
      <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby={titleId}>
        {baseOptions.map((option) => {
          const selected = option.id === preference;
          // Chế độ chưa có nguồn bản đồ hợp lệ (ví dụ Hành chính khi chưa có token VNSDI) thì không cho chọn.
          const unavailable =
            option.id !== 'auto' && usableChain(option.id, import.meta.env.PROD).length === 0;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              disabled={unavailable && !selected}
              title={unavailable ? t('Chưa có nguồn bản đồ được duyệt cho chế độ này') : undefined}
              onClick={() => onLayerChange(option.id)}
              className={`ui-button ui-button-secondary min-h-11 !gap-1 px-2 last:col-span-2 ${selected ? 'border-focus text-primary' : ''}`}
            >
              <Icon name={option.icon} size={15} />
              {t(option.label)}
            </button>
          );
        })}
      </div>

      <p
        className="mt-2 truncate text-[11px] leading-4 text-content-subtle"
        title={t('Nguồn: {sources}', { sources: SOURCE_CREDITS })}
      >
        {t('Nguồn: {sources}', { sources: SOURCE_CREDITS })}
      </p>

      <p className="mb-1 mt-3 text-xs font-bold text-content">{t('Lớp phủ')}</p>
      <ul className="space-y-0.5">
        {overlayOptions.map((option) => {
          const checked = overlays[option.key];
          const disabled =
            option.key === 'terrain' &&
            (base === 'satellite' || usableChain('terrain', import.meta.env.PROD).length === 0);
          return (
            <li key={option.key}>
              <button
                type="button"
                role="switch"
                aria-checked={checked && !disabled}
                disabled={disabled}
                title={t(option.hint)}
                onClick={() => onOverlaysChange({ ...overlays, [option.key]: !checked })}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left text-xs font-medium text-ink transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 disabled:opacity-40 dark:text-slate-200 dark:hover:bg-white/10"
              >
                {t(option.label)}
                <span
                  className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked && !disabled ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                  aria-hidden="true"
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow transition-all ${checked && !disabled ? 'left-[18px]' : 'left-0.5'}`}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}
