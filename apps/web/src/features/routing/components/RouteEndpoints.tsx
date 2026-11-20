import { useI18n } from '../../../shared/i18n/I18nProvider';
import { Icon } from '../../../shared/ui/Icon';
import { PlaceField } from '../../places/components/PlaceField';
import type { RoutePanelProps } from '../types';

type Props = Pick<RoutePanelProps, 'directions' | 'getSearchFocus'>;
export function RouteEndpoints({ directions, getSearchFocus }: Props) {
  const { origin, destination } = directions;
  const { t } = useI18n();
  return (
    <div className="relative mt-3 rounded-3xl bg-black/[.04] p-2.5 pl-8 pr-12 dark:bg-white/5">
      <span className="route-connector" aria-hidden="true" />
      <div className="space-y-2">
        <div className="relative">
          <span
            className="absolute -left-[22px] top-1/2 z-10 h-3 w-3 -translate-y-1/2 rounded-full border-[3px] border-brand-600 bg-white dark:border-brand-300 dark:bg-slate-900"
            aria-hidden="true"
          />
          <PlaceField
            getFocus={getSearchFocus}
            ariaLabel={t('Điểm xuất phát')}
            placeholder={t('Điểm xuất phát')}
            place={origin}
            onChange={directions.setOrigin}
            historyKind="origin"
          />
        </div>
        {directions.waypoints.map((item, index) => (
          <div key={item.key} className="relative">
            <span
              className="absolute -left-[24px] top-1/2 z-10 grid h-4 w-4 -translate-y-1/2 place-items-center rounded-full bg-brand-600 text-[11px] font-bold leading-none text-white"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <PlaceField
              getFocus={getSearchFocus}
              ariaLabel={t('Điểm dừng {number}', { number: index + 1 })}
              placeholder={t('Điểm dừng {number}', { number: index + 1 })}
              place={item.place}
              onChange={(place) => directions.setWaypoint(item.key, place)}
            />
            <div className="mt-1 flex justify-end gap-1 text-xs">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => directions.moveWaypoint(index, -1)}
                aria-label={t('Đưa điểm dừng {number} lên trước', { number: index + 1 })}
                title={t('Đưa điểm dừng {number} lên trước', { number: index + 1 })}
                className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-base font-bold text-ink-soft transition hover:bg-brand-100 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-30 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-indigo-400/20 dark:hover:text-white dark:focus-visible:ring-indigo-400/40"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === directions.waypoints.length - 1}
                onClick={() => directions.moveWaypoint(index, 1)}
                aria-label={t('Đưa điểm dừng {number} xuống sau', { number: index + 1 })}
                title={t('Đưa điểm dừng {number} xuống sau', { number: index + 1 })}
                className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-base font-bold text-ink-soft transition hover:bg-brand-100 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-30 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-indigo-400/20 dark:hover:text-white dark:focus-visible:ring-indigo-400/40"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => directions.removeWaypoint(item.key)}
                aria-label={t('Xóa điểm dừng {number}', { number: index + 1 })}
                className="h-7 rounded-full px-2.5 font-semibold text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
              >
                {t('Xóa')}
              </button>
            </div>
          </div>
        ))}
        <div className="relative">
          <Icon
            name="pin"
            size={20}
            className="absolute -left-[26px] top-1/2 z-10 -translate-y-1/2 fill-red-500/20 text-red-500"
          />
          <PlaceField
            getFocus={getSearchFocus}
            ariaLabel={t('Điểm đến')}
            placeholder={t('Bạn muốn đi đâu?')}
            place={destination}
            onChange={directions.setDestination}
            historyKind="destination"
          />
        </div>
      </div>
      <button
        type="button"
        disabled={!origin || !destination}
        onClick={directions.swap}
        className="absolute right-2 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white text-ink-soft shadow-md ring-1 ring-black/10 dark:ring-white/10 transition hover:text-brand-700 dark:hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 active:rotate-180 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-200"
        aria-label={t('Đảo chiều điểm đi và điểm đến')}
        title={t('Đảo chiều')}
      >
        <Icon name="swap" size={17} />
      </button>
    </div>
  );
}
