import { useI18n } from '../../../shared/i18n/I18nProvider';
import { Icon } from '../../../shared/ui/Icon';
import { SheetPanel } from '../../../shared/ui/SheetPanel';
import { useModeDurations } from '../hooks/useModeDurations';
import type { RoutePanelProps } from '../types';
import { RouteEndpoints } from './RouteEndpoints';
import { RoutePanelFooter } from './RoutePanelFooter';
import { RoutePreferences } from './RoutePreferences';
import { RouteResults } from './RouteResults';
import { RouteShareBar } from './RouteShareBar';
import { TravelModeTabs } from './TravelModeTabs';

/** Ô nào đang chờ người dùng chọn điểm trên bản đồ. */

const chipClass = (active: boolean) =>
  `inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'bg-brand-50 text-brand-700 ring-brand-300 dark:bg-brand-500/20 dark:text-brand-200 dark:ring-brand-400/50' : 'bg-white/70 text-ink ring-black/10 hover:bg-white dark:hover:bg-slate-700/60 dark:bg-white/5 dark:text-slate-100 dark:ring-white/15'}`;

/** Panel Chỉ đường giữ nguyên thứ tự các điểm do người dùng sắp xếp. */
export function RoutePanel({
  getSearchFocus,
  directions,
  trafficLayer,
  pickTarget,
  isLocating,
  onPickOnMap,
  onUseMyLocation,
  onSave,
  onStartNavigation,
  onPreviewRoute,
  isNavigating,
  onClose,
  presentationSlot,
}: RoutePanelProps) {
  const { t } = useI18n();
  const { origin, destination, vehicle, objective, avoidFerry, route, error } = directions;
  const durations = useModeDurations(directions);
  const footer = (
    <RoutePanelFooter
      directions={directions}
      onSave={onSave}
      onStartNavigation={onStartNavigation}
      isNavigating={isNavigating}
    />
  );

  return (
    <SheetPanel
      eyebrow={t('Lộ trình')}
      title={t('Chỉ đường')}
      icon="directions"
      onClose={onClose}
      footer={footer}
    >
      <TravelModeTabs vehicle={vehicle} durations={durations} onSelect={directions.setVehicle} />

      {/* Khối điểm đi / điểm đến nối bằng đường chấm dọc. */}
      <RouteEndpoints getSearchFocus={getSearchFocus} directions={directions} />

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={directions.waypoints.length >= 8}
          onClick={directions.addWaypoint}
          className={chipClass(false)}
        >
          <Icon name="plus" size={13} />
          {t('Thêm điểm dừng')}
        </button>
        <button type="button" disabled={isLocating} onClick={onUseMyLocation} className={chipClass(false)}>
          <Icon name="current-location" size={13} />
          {isLocating ? t('Đang định vị…') : t('Vị trí của tôi')}
        </button>
        <button
          type="button"
          aria-pressed={pickTarget === 'origin'}
          onClick={() => onPickOnMap('origin')}
          className={chipClass(pickTarget === 'origin')}
        >
          <Icon name="pin" size={13} />
          {t('Chọn điểm đi')}
        </button>
        <button
          type="button"
          aria-pressed={pickTarget === 'destination'}
          onClick={() => onPickOnMap('destination')}
          className={chipClass(pickTarget === 'destination')}
        >
          <Icon name="pin" size={13} />
          {t('Chọn điểm đến')}
        </button>
      </div>
      {directions.waypoints.length > 0 && (
        <p className="mt-1.5 rounded-xl border border-brand-200/70 bg-brand-50/70 px-3 py-2 text-xs leading-5 text-brand-900 dark:border-indigo-300/20 dark:bg-indigo-400/10 dark:text-indigo-100">
          {t('Tuyến sẽ đi theo thứ tự bạn đặt. Dùng mũi tên để sắp xếp điểm dừng.')}
        </p>
      )}

      <RoutePreferences directions={directions} />

      {origin && destination && (
        <div className="mt-2">
          <RouteShareBar
            route={{
              origin,
              destination,
              vehicle,
              // Chia sẻ đủ điểm ghé và tùy chọn để người nhận mở ra đúng tuyến này.
              via: directions.waypoints.flatMap((item) => (item.place ? [item.place] : [])),
              objective,
              avoidFerry,
            }}
          />
        </div>
      )}

      {error && (
        <p
          className="mt-3 rounded-2xl bg-amber-50 dark:bg-amber-400/10 px-3 py-2.5 text-xs leading-5 text-amber-900 dark:text-amber-100 ring-1 ring-amber-200"
          role="alert"
        >
          {t(error)}
        </p>
      )}

      <RouteResults
        directions={directions}
        trafficLayer={trafficLayer}
        onPreviewRoute={onPreviewRoute}
        isNavigating={isNavigating}
      />

      {presentationSlot}

      {!route && (
        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-ink-soft dark:text-slate-400">
          <Icon name="info" size={14} className="mt-0.5 shrink-0" />
          {t('Tuyến VietMap theo phương tiện và tùy chọn đã chọn. Thời gian là ước tính.')}
        </p>
      )}
    </SheetPanel>
  );
}

export type { PickTarget } from '../types';
