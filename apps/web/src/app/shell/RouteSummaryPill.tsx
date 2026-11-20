import type { RoutePlan } from '../../features/routing/types';
import { formatDistanceKm, formatDurationMinutes } from '../../shared/format/units';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { Icon } from '../../shared/ui/Icon';

/** Tóm tắt tuyến đang hiển thị khi panel chỉ đường đã đóng (nhiều điểm, tuyến đã lưu…). */
export function RouteSummaryPill({ route }: { route: RoutePlan }) {
  const { t, language } = useI18n();
  return (
    <div className="absolute right-3 top-[68px] z-10 flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-xs font-semibold text-ink shadow-glass dark:shadow-glass-dark ring-1 ring-black/5 backdrop-blur-xl max-md:top-[112px] dark:bg-slate-900/85 dark:text-slate-100 dark:ring-white/10">
      <Icon name="route" size={14} className="text-brand-600 dark:text-indigo-300" />
      {formatDistanceKm(route.distanceKm, language)} · {formatDurationMinutes(route.durationMin, language)}
      <span className="rounded-full bg-amber-100 dark:bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-800 dark:text-amber-200">
        {t('Ước tính')}
      </span>
    </div>
  );
}
