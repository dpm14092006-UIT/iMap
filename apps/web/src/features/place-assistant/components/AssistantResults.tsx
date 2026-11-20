import { stopCategoryLabels } from '@routetwin/shared';
import { useI18n } from '../../../shared/i18n/I18nProvider';
import { Button } from '../../../shared/ui/Button';
import type { usePlaceAssistant } from '../hooks/usePlaceAssistant';
import type { PlaceAssistantPanelProps } from '../types';

type Props = Pick<PlaceAssistantPanelProps, 'route' | 'onFocus' | 'onDirections' | 'onAddStop'> & {
  form: Pick<
    ReturnType<typeof usePlaceAssistant>,
    'result' | 'loading' | 'numberLocale' | 'submit' | 'applyResult'
  >;
};
export function AssistantResults({ route, onFocus, onDirections, onAddStop, form }: Props) {
  const { result, loading, numberLocale, submit, applyResult } = form;

  const { t } = useI18n();
  return (
    <>
      {result && (
        <div aria-live="polite" className="mt-4 space-y-3">
          <p className="text-[11px] font-semibold text-content-subtle">
            {result.source === 'ai'
              ? t('AI hiểu yêu cầu')
              : t('Đang dùng bộ lọc ngôn ngữ; chưa có kết quả từ AI')}
          </p>
          {result.status === 'clarify' ? (
            <div className="rounded-xl border border-brand-100 dark:border-indigo-300/20 bg-brand-50 dark:bg-indigo-400/10 p-3">
              <p className="text-[12px] font-semibold text-content">{result.question}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.suggestions.map((value) => (
                  <button
                    type="button"
                    key={value}
                    disabled={loading}
                    onClick={() => {
                      void submit(value);
                    }}
                    className="rounded-full border border-brand-200 dark:border-indigo-300/25 bg-surface px-3 py-2 text-[11px] font-semibold text-brand-700 dark:text-indigo-300"
                  >
                    {t(stopCategoryLabels[value])}
                  </button>
                ))}
              </div>
            </div>
          ) : result.status === 'needs_location' || result.status === 'needs_route' ? (
            <p className="rounded-xl bg-amber-50 dark:bg-amber-400/10 p-3 text-[11px] text-amber-900 dark:text-amber-100">
              {result.message}
            </p>
          ) : result.mode === 'nearby' ? (
            <>
              <p className="text-[11px] text-content-subtle">
                {t('{category} · bán kính {radius} km · khoảng cách đường thẳng.', {
                  category: t(stopCategoryLabels[result.category]),
                  radius: (result.radiusMeters / 1000).toLocaleString(numberLocale, {
                    maximumFractionDigits: 1,
                  }),
                })}
              </p>
              {!result.places.length && (
                <p className="text-[11px] text-content-muted">
                  {t('Chưa có kết quả trong phạm vi dữ liệu khảo sát. Thử đổi vị trí hoặc bán kính.')}
                </p>
              )}
              {result.places.map(({ place, distanceMeters }) => (
                <article key={place.id} className="rounded-xl border border-line p-3">
                  <h3 className="text-[12px] font-bold text-content">{place.name}</h3>
                  <p className="mt-1 text-[11px] text-content-subtle">{place.address}</p>
                  <p className="mt-2 text-[11px] text-content-muted">
                    {t('Cách vị trí chọn khoảng {distance} km đường thẳng.', {
                      distance: (distanceMeters / 1000).toLocaleString(numberLocale, {
                        maximumFractionDigits: 2,
                      }),
                    })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onFocus(place)}
                      className="rounded-lg border border-line px-2 py-2 text-[11px] font-semibold"
                    >
                      {t('Xem trên bản đồ')}
                    </button>
                    <Button
                      type="button"
                      onClick={() => applyResult(() => onDirections(place))}
                      className="rounded-lg bg-brand-600 px-2 py-2 text-[11px] font-semibold text-white"
                    >
                      {t('Chỉ đường đến đây')}
                    </Button>
                    <a
                      href={place.osmUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="self-center text-[11px] text-brand-700 dark:text-indigo-300 underline"
                    >
                      {t('Nguồn OSM')}
                    </a>
                  </div>
                </article>
              ))}
            </>
          ) : (
            <>
              <p className="text-[11px] text-content-subtle">
                {t('{category} · tối đa {distance} km và {duration} phút đi thêm.', {
                  category: t(stopCategoryLabels[result.category]),
                  distance: (result.routeStops.interpretation.maxExtraDistanceMeters / 1000).toLocaleString(
                    numberLocale,
                    { maximumFractionDigits: 1 },
                  ),
                  duration: (result.routeStops.interpretation.maxExtraDurationSeconds / 60).toLocaleString(
                    numberLocale,
                    { maximumFractionDigits: 1 },
                  ),
                })}
              </p>
              {!result.routeStops.candidates.length && (
                <p className="text-[11px] text-content-muted">
                  {t('Chưa tìm thấy điểm đáp ứng giới hạn trong phạm vi khảo sát.')}
                </p>
              )}
              {result.routeStops.candidates.map((candidate) => (
                <article
                  key={candidate.place.id}
                  className="rounded-xl border border-brand-100 dark:border-indigo-300/20 bg-brand-50/40 dark:bg-indigo-400/10 p-3"
                >
                  <h3 className="text-[12px] font-bold text-content">{candidate.place.name}</h3>
                  <p className="mt-1 text-[11px] text-content-subtle">{candidate.place.address}</p>
                  <p className="mt-2 text-[11px] leading-5 text-content-muted">{candidate.reason}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <a
                      href={candidate.place.osmUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-brand-700 dark:text-indigo-300 underline"
                    >
                      {t('Nguồn OSM')}
                    </a>
                    <Button
                      type="button"
                      onClick={() =>
                        applyResult(() => {
                          if (route) onAddStop(candidate, route.id);
                        })
                      }
                      className="rounded-lg bg-brand-600 px-3 py-2 text-[11px] font-semibold text-white"
                    >
                      {t('Ghé điểm này')}
                    </Button>
                  </div>
                </article>
              ))}
            </>
          )}
          {'warnings' in result && result.warnings.length > 0 && (
            <details open className="text-[11px] leading-4 text-content-subtle">
              <summary className="cursor-pointer">{t('Nguồn dữ liệu và giới hạn')}</summary>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {result.warnings.map((warning, index) => (
                  <li key={`${index}-${warning}`}>{t(warning)}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </>
  );
}
