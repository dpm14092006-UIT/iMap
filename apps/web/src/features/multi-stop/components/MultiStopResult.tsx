import { useI18n } from '../../../shared/i18n/I18nProvider';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import type { useMultiStopForm } from '../hooks/useMultiStopForm';
import type { MultiStopPanelProps } from '../types';
import { OptimizationSummary } from './OptimizationSummary';

type Props = Pick<MultiStopPanelProps, 'onStartNavigation' | 'isNavigating' | 'onSave'> & {
  form: Pick<ReturnType<typeof useMultiStopForm>, 'start' | 'plan'>;
};
export function MultiStopResult({ onStartNavigation, isNavigating, onSave, form }: Props) {
  const { start, plan } = form;

  const { language, t } = useI18n();
  return (
    <>
      {plan && (
        <div
          className="mt-3 rounded-xl border border-brand-100 dark:border-indigo-300/20 bg-brand-50/70 dark:bg-indigo-400/10 px-3 py-3"
          role="status"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-brand-800 dark:text-indigo-300">
                {t('Đã sắp xếp hành trình')}
              </p>
              <p className="mt-1 text-[11px] text-brand-800/80 dark:text-indigo-300/80">
                {plan.distanceKm.toLocaleString(language === 'en' ? 'en-US' : 'vi-VN', {
                  maximumFractionDigits: 1,
                })}{' '}
                km · {t('{minutes} phút', { minutes: Math.round(plan.durationMin) })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSave?.(plan)}
              className="rounded-lg border border-brand-200 dark:border-indigo-300/25 bg-surface px-2.5 py-2 text-[11px] font-semibold text-brand-700 dark:text-indigo-300"
            >
              {t('Lưu')}
            </button>
          </div>
          <Button
            type="button"
            onClick={() => onStartNavigation(plan)}
            disabled={isNavigating}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-[11px] font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:bg-emerald-600"
          >
            <Icon name={isNavigating ? 'check' : 'directions'} size={15} />
            {isNavigating ? t('Đang dẫn đường') : t('Bắt đầu chuyến đi')}
          </Button>
          {plan.optimization && <OptimizationSummary optimization={plan.optimization} />}
          <ol className="mt-3 space-y-1.5">
            {plan.stops.map((place, index) => (
              <li
                key={`${place.id}-${index}`}
                className="flex items-center gap-2 text-[11px] font-medium text-content-muted"
              >
                <span className="grid h-5 w-5 place-items-center rounded-full bg-surface text-[11px] font-bold text-brand-700 dark:text-indigo-300">
                  {index === 0
                    ? 'A'
                    : index === plan.stops.length - 1 && place.id === start?.id
                      ? '↩'
                      : index}
                </span>
                {place.name}
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}
