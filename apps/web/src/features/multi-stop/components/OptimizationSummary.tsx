import type { RouteOptimization } from '../../map/types';
import { formatDistanceMeters, formatDurationMinutes } from '../../navigation/utils/format';
import { useI18n, type Language } from '../../../shared/i18n/I18nProvider';

/** Đổi chi phí ma trận (giây hoặc mét) sang chữ dễ đọc. */
function formatCost(cost: number, objective: RouteOptimization['objective'], language: Language): string {
  if (language === 'vi') {
    return objective === 'distance' ? formatDistanceMeters(cost) : formatDurationMinutes(cost / 60);
  }

  if (objective === 'distance') {
    return cost < 1000
      ? `${Math.round(cost)} m`
      : `${(cost / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} km`;
  }

  const minutes = Math.max(1, Math.round(cost / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

/** Dòng tóm tắt: phần tiết kiệm so với thứ tự người dùng nhập. */
export function OptimizationSummary({ optimization }: { optimization: RouteOptimization }) {
  const { language, t } = useI18n();
  const { originalCost, optimizedCost, objective } = optimization;
  const saving =
    originalCost !== null && originalCost > 0 ? Math.round(100 * (1 - optimizedCost / originalCost)) : null;

  return (
    <div className="mt-2 rounded-lg bg-white/80 dark:bg-slate-800/60 px-2.5 py-2 text-[11px] leading-4 text-slate-600 dark:text-slate-300">
      {saving === null ? (
        <p>
          {t('Thứ tự bạn nhập không đi được; đã tìm thứ tự hợp lệ ({cost}).', {
            cost: formatCost(optimizedCost, objective, language),
          })}
        </p>
      ) : saving > 0 ? (
        <p>
          {t('Tiết kiệm ')}
          <b className="text-emerald-700 dark:text-emerald-300">{saving}%</b>{' '}
          {t('so với thứ tự bạn nhập: {original} → {optimized}.', {
            original: formatCost(originalCost!, objective, language),
            optimized: formatCost(optimizedCost, objective, language),
          })}
        </p>
      ) : (
        <p>
          {t('Thứ tự bạn nhập đã là tốt nhất ({cost}).', {
            cost: formatCost(optimizedCost, objective, language),
          })}
        </p>
      )}
      <p className="mt-0.5 text-slate-400 dark:text-slate-500">
        {t('Tính theo ma trận chi phí VietMap, có thể lệch nhẹ so với tuyến cuối.')}
      </p>
    </div>
  );
}
