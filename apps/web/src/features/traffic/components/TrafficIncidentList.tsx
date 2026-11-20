import { useI18n } from '../../../shared/i18n/I18nProvider';
import { incidentOptions, severityOptions, vehicleScopeLabels } from '../domain/trafficPresentation';
import type { useTrafficReportForm } from '../hooks/useTrafficReportForm';
import type { TrafficReportPanelProps } from '../types';

type Props = Pick<TrafficReportPanelProps, 'incidents' | 'isAuthenticated' | 'loading' | 'error'> & {
  form: Pick<ReturnType<typeof useTrafficReportForm>, 'photoUrls' | 'busyReportId' | 'verify'>;
};
export function TrafficIncidentList({ incidents, isAuthenticated, loading, error, form }: Props) {
  const { photoUrls, busyReportId, verify } = form;

  const { language, t } = useI18n();
  return (
    <div className="mt-5 border-t border-line/60 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[12px] font-bold text-content">{t('Báo cáo gần đây')}</h3>
        <span className="rounded-full bg-surface-raised px-2 py-1 text-[11px] font-bold text-content-muted">
          {incidents.length}
        </span>
      </div>
      {loading && (
        <p className="mb-2 text-[11px] text-content-subtle" role="status">
          {t('Đang đồng bộ báo cáo…')}
        </p>
      )}
      {incidents.length ? (
        <ul className="space-y-2">
          {incidents.slice(0, 8).map((incident) => {
            const selectedType = incidentOptions.find((option) => option.id === incident.type);
            const selectedSeverity = severityOptions.find((option) => option.id === incident.severity);
            return (
              <li key={incident.id} className="rounded-xl bg-surface-muted px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${selectedSeverity?.color ?? 'bg-slate-400 dark:bg-slate-500'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold text-content">
                      {t(selectedType?.label ?? 'Sự cố')} · {t(incident.description)}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-content-subtle">
                      {new Date(incident.time).toLocaleTimeString(language === 'en' ? 'en-US' : 'vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      ·{' '}
                      {incident.vehicleScope === 'both'
                        ? t('Ô tô + xe máy')
                        : t(vehicleScopeLabels[incident.vehicleScope])}{' '}
                      · {incident.lat.toFixed(4)}, {incident.lng.toFixed(4)}
                    </span>
                  </span>
                </div>
                <p className="mt-1 pl-4 text-[11px] font-medium text-brand-700 dark:text-indigo-300">
                  {t('{count} báo cáo trong 30 phút / 75 m · {reporters} người gửi riêng biệt', {
                    count: Math.max(1, incident.communityReportCount ?? 1),
                    reporters: Math.max(1, incident.communityReporterCount ?? 1),
                  })}
                  {incident.communityUpdatedAt
                    ? ` · ${t('cập nhật')} ${new Date(incident.communityUpdatedAt).toLocaleTimeString(language === 'en' ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                    : ` · ${t('chưa có xác nhận mới')}`}
                </p>
                {incident.imagePath && photoUrls[incident.id] && (
                  <a
                    href={photoUrls[incident.id]}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t('Mở ảnh minh chứng')}
                    className="mt-2 block overflow-hidden rounded-lg"
                  >
                    <img
                      src={photoUrls[incident.id]}
                      alt={t('Ảnh minh chứng: {incident}', {
                        incident: t(selectedType?.label ?? 'sự cố giao thông'),
                      })}
                      loading="lazy"
                      className="max-h-36 w-full rounded-lg object-cover"
                    />
                  </a>
                )}
                {incident.imagePath && !photoUrls[incident.id] && (
                  <p className="mt-1.5 pl-4 text-[11px] text-content-subtle">{t('Có ảnh minh chứng')}</p>
                )}
                {isAuthenticated && (
                  <div className="mt-2 flex gap-2 pl-4">
                    <button
                      type="button"
                      disabled={busyReportId === incident.id}
                      onClick={() => void verify(incident.id, 'clear')}
                      className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-emerald-400/20 hover:bg-emerald-50 dark:hover:bg-emerald-400/15 disabled:opacity-50"
                    >
                      {t('Đã thông')}
                    </button>
                    <button
                      type="button"
                      disabled={busyReportId === incident.id}
                      onClick={() => void verify(incident.id, 'still_active')}
                      className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-content-muted ring-1 ring-slate-200 dark:ring-white/10 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-50"
                    >
                      {t('Vẫn còn')}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : !loading && !error ? (
        <p className="rounded-xl bg-surface-muted px-3 py-4 text-center text-[11px] leading-5 text-content-subtle">
          {t('Chưa có báo cáo trong khu vực này. Hãy chọn vị trí và gửi cập nhật đầu tiên.')}
        </p>
      ) : null}
    </div>
  );
}
