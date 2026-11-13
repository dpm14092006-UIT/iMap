import { Icon, type IconName } from '../../../shared/components/Icon';
import type { TransportMode } from '../../map/types';
import type { ModeDurations } from '../hooks/useModeDurations';
import { formatDurationShort } from '../utils/format';
import { useI18n } from '../../../shared/i18n/I18nProvider';

type TravelModeTabsProps = {
  vehicle: TransportMode;
  durations: ModeDurations;
  onSelect: (mode: TransportMode) => void;
};

const supported: { id: TransportMode; label: string; icon: IconName }[] = [
  { id: 'motorcycle', label: 'Xe máy', icon: 'motorcycle' },
  { id: 'car', label: 'Ô tô', icon: 'car' },
];

const tabClass = (active: boolean, enabled: boolean) =>
  `flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-2 text-[11px] max-md:flex-row max-md:justify-center max-md:gap-1.5 max-md:py-2 font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 ${active ? 'bg-brand-gradient text-white shadow-md' : enabled ? 'text-ink-soft hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10' : 'cursor-not-allowed text-slate-400 dark:text-slate-500'}`;

/** Thẻ phương tiện kèm thời gian ước tính; chỉ xe máy và ô tô được backend hỗ trợ. */
export function TravelModeTabs({ vehicle, durations, onSelect }: TravelModeTabsProps) {
  const { language, t } = useI18n();
  const known = supported.filter((mode) => durations[mode.id] !== undefined);
  const best =
    known.length === supported.length
      ? known.reduce((a, b) => (durations[a.id]! <= durations[b.id]! ? a : b))
      : null;
  const bestMinutes = known.length ? Math.min(...known.map((mode) => durations[mode.id]!)) : undefined;

  return (
    <div
      className="flex gap-1 rounded-3xl bg-black/[.04] p-1 dark:bg-white/5"
      role="group"
      aria-label={t('Phương tiện')}
    >
      <button
        type="button"
        disabled={!best}
        aria-pressed={best !== null && best.id === vehicle}
        title={
          best
            ? t('Chọn phương tiện nhanh nhất: {vehicle}', { vehicle: t(best.label) })
            : t('Tính tuyến cho cả xe máy và ô tô để biết phương tiện nhanh nhất')
        }
        onClick={() => best && onSelect(best.id)}
        className={tabClass(best !== null && best.id === vehicle, best !== null)}
      >
        <Icon name="sparkles" size={16} className="shrink-0" />
        {t('Tốt nhất')}
        <span className={`font-normal opacity-80 ${bestMinutes === undefined ? 'max-md:hidden' : ''}`}>
          {bestMinutes === undefined ? '—' : formatDurationShort(bestMinutes, language)}
        </span>
      </button>
      {supported.map((mode) => (
        <button
          key={mode.id}
          type="button"
          aria-pressed={vehicle === mode.id}
          onClick={() => onSelect(mode.id)}
          className={tabClass(vehicle === mode.id, true)}
        >
          <Icon name={mode.icon} size={16} className="shrink-0" />
          {t(mode.label)}
          <span
            className={`font-normal opacity-80 ${durations[mode.id] === undefined ? 'max-md:hidden' : ''}`}
          >
            {durations[mode.id] === undefined ? '—' : formatDurationShort(durations[mode.id]!, language)}
          </span>
        </button>
      ))}
    </div>
  );
}
