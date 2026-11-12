import type { RouteOptimization } from '../../map/types';
import { formatDistanceMeters, formatDurationMinutes } from '../../navigation/utils/format';
import { usedAlgorithmLabels } from '../utils/algorithms';

/** Đổi chi phí ma trận (giây hoặc mét) sang chữ dễ đọc. */
function formatCost(cost: number, objective: RouteOptimization['objective']): string {
  return objective === 'distance' ? formatDistanceMeters(cost) : formatDurationMinutes(cost / 60);
}

/** Dòng tóm tắt: thuật toán đã dùng và tiết kiệm bao nhiêu so với thứ tự người dùng nhập. */
export function OptimizationSummary({ optimization }: { optimization: RouteOptimization }) {
  const { algorithm, originalCost, optimizedCost, objective } = optimization;
  const saving =
    originalCost !== null && originalCost > 0 ? Math.round(100 * (1 - optimizedCost / originalCost)) : null;

  return (
    <div className="mt-2 rounded-lg bg-white/80 dark:bg-slate-800/60 px-2.5 py-2 text-[11px] leading-4 text-slate-600 dark:text-slate-300">
      <p className="font-semibold text-brand-800 dark:text-indigo-300">{usedAlgorithmLabels[algorithm]}</p>
      {saving === null ? (
        <p>Thứ tự bạn nhập không đi được; đã tìm thứ tự hợp lệ ({formatCost(optimizedCost, objective)}).</p>
      ) : saving > 0 ? (
        <p>
          Tiết kiệm <b className="text-emerald-700 dark:text-emerald-300">{saving}%</b> so với thứ tự bạn nhập:{' '}
          {formatCost(originalCost!, objective)} → {formatCost(optimizedCost, objective)}.
        </p>
      ) : (
        <p>Thứ tự bạn nhập đã là tốt nhất ({formatCost(optimizedCost, objective)}).</p>
      )}
      <p className="mt-0.5 text-slate-400 dark:text-slate-500">
        Tính theo ma trận chi phí VietMap, có thể lệch nhẹ so với tuyến cuối.
      </p>
    </div>
  );
}
