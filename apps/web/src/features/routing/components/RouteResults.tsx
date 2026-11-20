import { useI18n } from '../../../shared/i18n/I18nProvider';
import { routeTrafficSeverity } from '../../traffic/domain/routeTraffic';
import { minutesSlowerThanFastest, routeLabels } from '../domain/routeLabels';
import type { RoutePanelProps } from '../types';
import { RouteComparisonPanel } from './RouteComparisonPanel';
import { RouteOptionCard } from './RouteOptionCard';

type Props = Pick<RoutePanelProps, 'directions' | 'trafficLayer' | 'onPreviewRoute' | 'isNavigating'>;
export function RouteResults({ directions, trafficLayer, onPreviewRoute, isNavigating }: Props) {
  const { route, routeOptions } = directions;
  const maxDuration = Math.max(...routeOptions.map((item) => item.durationMin), 1);
  const { t } = useI18n();
  return (
    <>
      {' '}
      {routeOptions.length > 0 && route && (
        <section className="mt-4" aria-label={t('Các tuyến có thể đi')}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-content">{t('Các tuyến có thể đi')}</h3>
            <span className="text-xs text-ink-soft dark:text-slate-400">
              {t('{count} phương án', { count: routeOptions.length })}
            </span>
          </div>
          {directions.comparison && (
            <RouteComparisonPanel
              key={directions.comparison.token}
              snapshot={directions.comparison}
              compare={directions.compare}
              onChoose={directions.chooseRoute}
              onRefresh={() => void directions.calculate()}
              selectedId={route.id}
              isNavigating={isNavigating}
            />
          )}
          <ul className="space-y-2.5" aria-live="polite">
            {routeOptions.map((item) => (
              <RouteOptionCard
                key={item.id}
                route={item}
                comparisonId={directions.comparison?.routes.find(({ planId }) => planId === item.id)?.id}
                labels={routeLabels(item, routeOptions)}
                deltaMinutes={minutesSlowerThanFastest(item, routeOptions)}
                maxDurationMin={maxDuration}
                severity={routeTrafficSeverity(item, trafficLayer)}
                selected={item.id === route.id}
                onSelect={() => directions.chooseRoute(item.id)}
                onPreview={() => onPreviewRoute(item)}
              />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
