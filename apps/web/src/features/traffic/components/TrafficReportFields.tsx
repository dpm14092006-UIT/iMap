import { useI18n } from '../../../shared/i18n/I18nProvider';
import { Icon } from '../../../shared/ui/Icon';
import { incidentOptions } from '../domain/trafficPresentation';
import type { useTrafficReportForm } from '../hooks/useTrafficReportForm';
import type { TrafficReportPanelProps } from '../types';

type Props = Pick<TrafficReportPanelProps, 'selectedPoint'> & {
  form: Pick<ReturnType<typeof useTrafficReportForm>, 'type' | 'setType'>;
};
export function TrafficReportFields({ selectedPoint, form }: Props) {
  const { type, setType } = form;

  const { t } = useI18n();
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-end justify-between gap-2">
        <h3 className="text-[12px] font-bold text-content">{t('Báo cáo sự cố')}</h3>
        <span className="text-right text-[11px] text-slate-400 dark:text-slate-500">
          {selectedPoint
            ? `${selectedPoint.lat.toFixed(5)}, ${selectedPoint.lng.toFixed(5)}`
            : t('Chạm bản đồ để chọn vị trí')}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {incidentOptions.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={type === item.id}
            onClick={() => setType(item.id)}
            className={`flex min-h-[60px] flex-col items-center justify-center gap-1.5 rounded-xl border text-[11px] font-semibold transition ${type === item.id ? 'border-brand-200 dark:border-indigo-300/25 bg-brand-50 dark:bg-indigo-400/10 text-brand-700 dark:text-indigo-300' : 'border-line bg-surface text-content-muted hover:border-slate-300 dark:hover:border-white/20'}`}
          >
            <Icon name={item.icon} size={17} />
            {t(item.label)}
          </button>
        ))}
      </div>
    </div>
  );
}
