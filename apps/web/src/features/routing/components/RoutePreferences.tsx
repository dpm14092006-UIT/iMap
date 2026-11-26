import { useState } from 'react';
import { useI18n } from '../../../shared/i18n/I18nProvider';
import { Icon } from '../../../shared/ui/Icon';
import { Popover } from '../../../shared/ui/Popover';
import type { RoutePanelProps } from '../types';
import { DepartureSelect } from './DepartureSelect';
const chipClass = (active: boolean) =>
  `inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'bg-brand-50 text-brand-700 ring-brand-300 dark:bg-brand-500/20 dark:text-brand-200 dark:ring-brand-400/50' : 'bg-white/70 text-ink ring-black/10 hover:bg-white dark:hover:bg-slate-700/60 dark:bg-white/5 dark:text-slate-100 dark:ring-white/15'}`;
type Props = Pick<RoutePanelProps, 'directions'>;
export function RoutePreferences({ directions }: Props) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const { objective, avoidFerry, route } = directions;
  const optionCount = Number(objective === 'distance') + Number(avoidFerry);
  const { t } = useI18n();
  return (
    <div className="mt-3 flex items-start justify-between gap-2">
      <DepartureSelect durationMin={route ? route.durationMin : null} />
      <Popover
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        label={t('Tùy chọn tuyến')}
        panelClassName="right-0 top-full mt-1.5 w-64"
        className="shrink-0"
        trigger={
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={optionsOpen}
            onClick={() => setOptionsOpen((current) => !current)}
            className={chipClass(optionCount > 0)}
          >
            <Icon name="filter" size={13} />
            {t('Tùy chọn')}
            {optionCount > 0 ? ` (${optionCount})` : ''}
          </button>
        }
      >
        <p className="mb-1.5 text-xs font-bold text-content">{t('Ưu tiên tuyến')}</p>
        <div
          className="grid grid-cols-2 gap-1 rounded-2xl bg-black/[.05] p-1 dark:bg-white/10"
          role="radiogroup"
          aria-label={t('Tiêu chí tìm tuyến')}
        >
          {(
            [
              ['time', 'Nhanh nhất'],
              ['distance', 'Ngắn nhất'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={objective === id}
              onClick={() => directions.setObjective(id)}
              className={`rounded-xl px-2 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 ${objective === id ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-200' : 'text-ink-soft dark:text-slate-300'}`}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={avoidFerry}
          onClick={() => directions.setAvoidFerry(!avoidFerry)}
          className="mt-2 flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-xs font-medium text-ink hover:bg-black/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 dark:text-slate-100 dark:hover:bg-white/10"
        >
          {t('Tránh phà')}
          <span
            className={`relative h-5 w-9 rounded-full transition ${avoidFerry ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'}`}
            aria-hidden="true"
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow transition-all ${avoidFerry ? 'left-[18px]' : 'left-0.5'}`}
            />
          </span>
        </button>
        <p
          className="mt-1 px-2 text-[11px] text-ink-soft dark:text-slate-400"
          title={t('VietMap hiện chưa hỗ trợ loại trừ cao tốc trong API tuyến đang dùng.')}
        >
          {t('Tránh cao tốc: chưa hỗ trợ')}
        </p>
      </Popover>
    </div>
  );
}
