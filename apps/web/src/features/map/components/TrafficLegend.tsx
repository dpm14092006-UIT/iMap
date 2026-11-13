import { useState } from 'react';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';

type TrafficLegendProps = {
  onHide: () => void;
};

const levels = [
  { label: 'Thông thoáng', color: 'bg-traffic-fast' },
  { label: 'Vừa phải', color: 'bg-traffic-moderate' },
  { label: 'Đông', color: 'bg-traffic-slow' },
  { label: 'Tắc', color: 'bg-traffic-jam' },
];

/** Chú giải giao thông dạng viên thuốc: 4 vạch màu + công tắc tắt lớp; điện thoại thu thành nút nhỏ. */
export function TrafficLegend({ onHide }: TrafficLegendProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [expanded, setExpanded] = useState(false);
  if (isMobile && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label="Hiện chú giải giao thông"
        title="Chú giải giao thông"
        className="grid h-11 w-11 place-items-center rounded-full bg-white/90 shadow-glass ring-1 ring-black/5 backdrop-blur-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:bg-slate-900/85 dark:shadow-glass-dark dark:ring-white/10 dark:focus-visible:ring-indigo-400/40"
      >
        <span className="flex flex-col gap-[3px]" aria-hidden="true">
          {levels.map((level) => (
            <span key={level.label} className={`h-[3px] w-4 rounded-full ${level.color}`} />
          ))}
        </span>
      </button>
    );
  }
  return (
    <div
      className="flex items-center gap-2.5 rounded-full bg-white/90 py-1.5 pl-3.5 pr-2 text-[11px] font-semibold text-ink-soft shadow-glass dark:shadow-glass-dark ring-1 ring-black/5 backdrop-blur-xl dark:bg-slate-900/85 dark:text-slate-300 dark:ring-white/10"
      role="group"
      aria-label="Chú giải giao thông"
      title="Màu tuyến theo dữ liệu giao thông VietMap"
    >
      <span className="sr-only">Màu tuyến theo dữ liệu giao thông VietMap</span>
      <span>Nhanh</span>
      <ul className="flex gap-1" aria-label="Mức độ từ nhanh đến chậm">
        {levels.map((level) => (
          <li key={level.label} title={level.label} className={`h-2 w-7 rounded-full ${level.color}`}>
            <span className="sr-only">{level.label}</span>
          </li>
        ))}
      </ul>
      <span>Chậm</span>
      {isMobile && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Thu gọn chú giải"
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-base leading-none text-ink-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:text-slate-300"
        >
          ×
        </button>
      )}
      <button
        type="button"
        role="switch"
        aria-checked="true"
        aria-label="Tắt lớp giao thông trực tiếp"
        onClick={onHide}
        className="relative h-5 w-9 shrink-0 rounded-full bg-brand-gradient focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40"
      >
        <span className="absolute left-[18px] top-0.5 h-4 w-4 rounded-full bg-white shadow" />
      </button>
    </div>
  );
}
