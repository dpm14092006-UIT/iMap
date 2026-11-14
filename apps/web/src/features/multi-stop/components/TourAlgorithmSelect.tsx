import type { OptimizeRouteRequest } from '@routetwin/shared';
import { useI18n } from '../../../shared/i18n/I18nProvider';

/** Lựa chọn thuật toán sắp xếp điểm ghé gửi lên POST /api/routes/optimize. */
export type TourAlgorithmChoice = OptimizeRouteRequest['algorithm'];

const options: { id: TourAlgorithmChoice; label: string }[] = [
  { id: 'auto', label: 'Tự động' },
  { id: 'exact', label: 'Chính xác (Held–Karp)' },
  { id: 'heuristic', label: 'Nhanh (NN + 2-opt)' },
];

const usedLabels: Record<'exact' | 'heuristic', string> = {
  exact: 'Lần tối ưu vừa rồi: Held–Karp · tối ưu chính xác',
  heuristic: 'Lần tối ưu vừa rồi: NN + 2-opt · gần đúng',
};

type TourAlgorithmSelectProps = {
  value: TourAlgorithmChoice;
  onChange: (value: TourAlgorithmChoice) => void;
  /** Thuật toán backend thực sự đã dùng ở lần tối ưu gần nhất ("auto" được quy về một trong hai). */
  lastUsed: 'exact' | 'heuristic' | null;
};

/**
 * Chọn thuật toán sắp xếp điểm ghé — chỉ hiện ở chế độ thuyết trình (?demo=1) để so sánh
 * lời giải chính xác (Held–Karp) với lời giải gần đúng (Nearest Neighbor + 2-opt) trên cùng một hành trình.
 */
export function TourAlgorithmSelect({ value, onChange, lastUsed }: TourAlgorithmSelectProps) {
  const { t } = useI18n();
  return (
    <div className="mb-3 rounded-2xl border border-dashed border-brand-200 p-3 dark:border-indigo-300/25">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[.1em] text-brand-600 dark:text-indigo-300">
        {t('Chế độ thuyết trình')}
      </p>
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          {t('Thuật toán sắp xếp')}
        </span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as TourAlgorithmChoice)}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100"
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {t(option.label)}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-1.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
        {t('Chính xác: Held–Karp luôn ra thứ tự tối ưu. Nhanh: NN + 2-opt, gần đúng — dùng để so sánh.')}
      </p>
      {lastUsed && (
        <p
          className="mt-1.5 text-[11px] font-semibold text-brand-700 dark:text-indigo-300"
          aria-live="polite"
        >
          {t(usedLabels[lastUsed])}
        </p>
      )}
    </div>
  );
}
