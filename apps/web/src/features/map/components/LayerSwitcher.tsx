import { useId, useState } from 'react';
import { Popover } from '../../../app/layout/Popover';
import { Icon } from '../../../shared/components/Icon';
import type { MapLayer, MapOverlays } from '../types';

type LayerSwitcherProps = {
  /** Bảng chức năng đang mở: trên điện thoại nút thu nhỏ lại. */
  compact?: boolean;
  layer: MapLayer;
  overlays: MapOverlays;
  onLayerChange: (layer: MapLayer) => void;
  onOverlaysChange: (overlays: MapOverlays) => void;
};

const baseOptions = [
  { id: 'street', label: 'Bản đồ' },
  { id: 'satellite', label: 'Vệ tinh' },
] as const;

const overlayOptions: { key: keyof MapOverlays; label: string; hint: string }[] = [
  { key: 'traffic', label: 'Giao thông trực tiếp', hint: 'Quầng màu quanh sự cố và đoạn tắc trên tuyến' },
  { key: 'incidents', label: 'Sự cố cộng đồng', hint: 'Marker kẹt xe, tai nạn, ngập…' },
  { key: 'terrain', label: 'Địa hình', hint: 'Đường đồng mức (chỉ với nền Bản đồ)' },
];

/** Ảnh xem trước của từng lớp nền, vẽ bằng gradient + vài nét đường. */
function LayerThumb({ kind, className = '' }: { kind: 'street' | 'satellite'; className?: string }) {
  const tone =
    kind === 'satellite'
      ? 'bg-gradient-to-br from-emerald-900 via-lime-800 to-stone-600'
      : 'bg-gradient-to-br from-emerald-100 via-amber-50 to-sky-100 dark:from-slate-800 dark:via-slate-700 dark:to-slate-900';
  return (
    <span className={`relative block overflow-hidden ${tone} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" fill="none">
        <path
          d="M-4 44 30 30 70 40M18-4 28 70M44-4 38 70"
          stroke={kind === 'satellite' ? '#d6d3d1' : '#fff'}
          strokeOpacity={kind === 'satellite' ? 0.35 : 0.9}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/** Nút thẻ ảnh "Lớp" ở góc dưới trái; mở popover chọn nền bản đồ và các lớp phủ. */
export function LayerSwitcher({
  compact = false,
  layer,
  overlays,
  onLayerChange,
  onOverlaysChange,
}: LayerSwitcherProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const base = layer === 'satellite' ? 'satellite' : 'street';
  const next = base === 'satellite' ? 'street' : 'satellite';

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      label="Lớp bản đồ"
      panelClassName="bottom-full left-0 mb-2 w-[272px]"
      trigger={
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-label="Lớp bản đồ"
          aria-expanded={open}
          aria-haspopup="dialog"
          className={`group relative block h-16 w-16 ${compact ? 'max-md:h-11 max-md:w-11' : ''} overflow-hidden rounded-2xl shadow-glass dark:shadow-glass-dark ring-2 ring-white transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 dark:focus-visible:ring-indigo-400/40 active:scale-95 dark:ring-slate-700`}
        >
          <LayerThumb kind={next} className="h-full w-full transition group-hover:scale-110" />
          <span
            className={`absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-slate-950/70 to-transparent pb-1 pt-4 text-[11px] font-bold text-white ${compact ? 'max-md:pb-0.5 max-md:pt-3 max-md:text-[10px]' : ''}`}
          >
            <Icon name="layers" size={12} />
            Lớp
          </span>
        </button>
      }
    >
      <p id={titleId} className="mb-2 text-xs font-bold text-ink dark:text-white">
        Loại bản đồ
      </p>
      <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby={titleId}>
        {baseOptions.map((option) => {
          const selected = option.id === base;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onLayerChange(option.id)}
              className={`rounded-2xl p-1 text-center text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 ${selected ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-500 dark:bg-brand-500/20 dark:text-brand-200' : 'text-ink-soft hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10'}`}
            >
              <LayerThumb kind={option.id} className="mb-1 h-14 w-full rounded-xl" />
              {option.label}
            </button>
          );
        })}
      </div>

      <p className="mb-1 mt-3 text-xs font-bold text-ink dark:text-white">Lớp phủ</p>
      <ul className="space-y-0.5">
        {overlayOptions.map((option) => {
          const checked = overlays[option.key];
          const disabled = option.key === 'terrain' && base === 'satellite';
          return (
            <li key={option.key}>
              <button
                type="button"
                role="switch"
                aria-checked={checked && !disabled}
                disabled={disabled}
                title={option.hint}
                onClick={() => onOverlaysChange({ ...overlays, [option.key]: !checked })}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left text-xs font-medium text-ink transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 disabled:opacity-40 dark:text-slate-200 dark:hover:bg-white/10"
              >
                {option.label}
                <span
                  className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked && !disabled ? 'bg-brand-gradient' : 'bg-slate-300 dark:bg-slate-600'}`}
                  aria-hidden="true"
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white dark:bg-slate-800/60 shadow transition-all ${checked && !disabled ? 'left-[18px]' : 'left-0.5'}`}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 flex items-center gap-1.5 border-t border-black/5 pt-2 text-[11px] text-ink-soft dark:border-white/10 dark:text-slate-400">
        <Icon name="moon" size={13} className="shrink-0" />
        Chế độ tối tự động 18:00–06:00
      </p>
    </Popover>
  );
}
