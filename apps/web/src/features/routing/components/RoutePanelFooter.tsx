import { useI18n } from '../../../shared/i18n/I18nProvider';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import type { RoutePanelProps } from '../types';

type Props = Pick<RoutePanelProps, 'directions' | 'onSave' | 'onStartNavigation' | 'isNavigating'>;
export function RoutePanelFooter({ directions, onSave, onStartNavigation, isNavigating }: Props) {
  const { origin, destination, route, isLoading } = directions;
  const canCalculate =
    Boolean(origin && destination) &&
    directions.waypoints.every((item) => item.place) &&
    (origin?.id !== destination?.id || directions.waypoints.length > 0) &&
    !isLoading;
  const { t } = useI18n();
  return route ? (
    <div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={() => onStartNavigation(route)}
          disabled={isNavigating}
          className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 px-4 text-sm font-bold text-white shadow-md shadow-indigo-900/25 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 dark:focus-visible:ring-indigo-400/40 active:scale-[.98] disabled:bg-none disabled:bg-emerald-600"
        >
          <Icon name={isNavigating ? 'check' : 'directions'} size={17} />
          {isNavigating ? t('Đang dẫn đường') : t('Bắt đầu')}
        </Button>
        <button
          type="button"
          onClick={onSave}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/70 px-4 text-sm font-semibold text-ink ring-1 ring-black/10 transition hover:bg-white dark:hover:bg-slate-700/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 active:scale-[.98] dark:bg-white/5 dark:text-slate-100 dark:ring-white/15"
        >
          <Icon name="bookmark" size={16} />
          {t('Lưu')}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-content-subtle">
        {t('GPS chỉ bật khi bạn nhấn Bắt đầu. Thời gian là ước tính và có thể đổi theo giao thông.')}
      </p>
    </div>
  ) : (
    <Button
      type="button"
      disabled={!canCalculate}
      onClick={() => void directions.calculate()}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-4 text-sm font-bold text-white shadow-md shadow-indigo-900/25 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 dark:focus-visible:ring-indigo-400/40 active:scale-[.98] disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-700"
    >
      {isLoading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          aria-hidden="true"
        />
      ) : (
        <Icon name="route" size={17} />
      )}
      {isLoading ? t('Đang lấy tuyến đường…') : t('Tìm đường')}
    </Button>
  );
}
