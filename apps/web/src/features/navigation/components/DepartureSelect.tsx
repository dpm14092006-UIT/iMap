import { useState } from 'react';
import { Popover } from '../../../app/layout/Popover';
import { Icon } from '../../../shared/components/Icon';
import { useI18n } from '../../../shared/i18n/I18nProvider';

type DepartureMode = 'now' | 'depart' | 'arrive';

type DepartureSelectProps = {
  /** Thời gian đi dự kiến (phút); null khi chưa có tuyến. */
  durationMin: number | null;
};

const modeLabels: Record<DepartureMode, string> = {
  now: 'Đi ngay',
  depart: 'Khởi hành lúc',
  arrive: 'Đến lúc',
};

const formatClock = (date: Date, language: 'vi' | 'en') =>
  date.toLocaleTimeString(language === 'en' ? 'en-US' : 'vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

/** Giờ HH:mm hôm nay (hoặc ngày mai nếu đã qua) làm mốc thời gian. */
function clockToDate(value: string, now: Date): Date {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  const date = new Date(now);
  date.setHours(hours, minutes, 0, 0);
  if (date.getTime() < now.getTime() - 60_000) date.setDate(date.getDate() + 1);
  return date;
}

/** Chọn Đi ngay / Khởi hành lúc / Đến lúc; chỉ là UI, hiển thị giờ đến (hoặc giờ nên đi) dự kiến. */
export function DepartureSelect({ durationMin }: DepartureSelectProps) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DepartureMode>('now');
  const [time, setTime] = useState(() => formatClock(new Date(), language));

  const label = mode === 'now' ? t(modeLabels.now) : `${t(modeLabels[mode])} ${time}`;
  let estimate = '';
  if (durationMin !== null) {
    const now = new Date();
    const anchor = mode === 'now' ? now : clockToDate(time, now);
    const ms = durationMin * 60_000;
    estimate =
      mode === 'arrive'
        ? t('Nên khởi hành lúc {time}', { time: formatClock(new Date(anchor.getTime() - ms), language) })
        : t('Dự kiến đến lúc {time}', { time: formatClock(new Date(anchor.getTime() + ms), language) });
  }

  return (
    <div className="min-w-0">
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        label={t('Thời điểm khởi hành')}
        panelClassName="left-0 top-full mt-1.5 w-60"
        trigger={
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-full bg-white/70 px-3 text-xs font-semibold text-ink ring-1 ring-black/10 transition hover:bg-white dark:hover:bg-slate-700/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 dark:bg-white/5 dark:text-slate-100 dark:ring-white/15"
          >
            <Icon name="clock" size={14} className="shrink-0" />
            <span className="truncate">{label}</span>
            <Icon name="chevron-down" size={13} className="shrink-0" />
          </button>
        }
      >
        <div role="radiogroup" aria-label={t('Thời điểm khởi hành')} className="space-y-0.5">
          {(Object.keys(modeLabels) as DepartureMode[]).map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mode === id}
              onClick={() => setMode(id)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 dark:hover:bg-white/10 ${mode === id ? 'text-brand-700 dark:text-brand-200' : 'text-ink dark:text-slate-200'}`}
            >
              {t(modeLabels[id])}
              {mode === id && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
        {mode !== 'now' && (
          <label className="mt-2 block text-[11px] font-semibold text-ink-soft dark:text-slate-300">
            {t('Giờ')}
            <input
              type="time"
              value={time}
              onChange={(event) => event.target.value && setTime(event.target.value)}
              className="mt-1 h-10 w-full rounded-xl bg-white/80 px-3 text-sm text-ink ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:text-slate-100 dark:ring-white/10 dark:focus:ring-indigo-400"
            />
          </label>
        )}
        <p className="mt-2 text-[11px] text-ink-soft dark:text-slate-400">
          {t('Chỉ để ước tính giờ đến, chưa dự báo tắc đường theo giờ.')}
        </p>
      </Popover>
      {estimate && (
        <p className="mt-1 pl-1 text-xs font-medium text-ink-soft dark:text-slate-300">{estimate}</p>
      )}
    </div>
  );
}
