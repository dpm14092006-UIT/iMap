import type { PathAlgorithm } from '@routetwin/shared';
import { Icon } from '../../../shared/components/Icon';
import type { AlgorithmComparisonController, AlgorithmObjective } from '../hooks/useAlgorithmComparison';
import { formatDistanceMeters, formatDurationMinutes } from '../utils/format';

type AlgorithmComparisonProps = { comparison: AlgorithmComparisonController; canRun: boolean };

const algorithmLabels: Record<PathAlgorithm, string> = { dijkstra: 'Dijkstra', astar: 'A*' };
const objectives: { id: AlgorithmObjective; label: string }[] = [
  { id: 'distance', label: 'Ngắn nhất' },
  { id: 'duration', label: 'Nhanh nhất' },
];

/**
 * Khối "So sánh thuật toán" trong panel chỉ đường.
 * Chạy Dijkstra và A* tự cài đặt trên đồ thị OSM, hiển thị bảng số liệu; tuyến A* vẽ nét đứt cam trên bản đồ.
 */
export function AlgorithmComparison({ comparison, canRun }: AlgorithmComparisonProps) {
  const { objective, result, isLoading, error } = comparison;
  const [dijkstra, astar] = result?.runs ?? [];
  // A* duyệt ít hơn Dijkstra bao nhiêu phần trăm.
  const saving =
    dijkstra && astar ? Math.round(100 * (1 - astar.visitedNodes / dijkstra.visitedNodes)) : null;

  return (
    <section
      className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3"
      aria-label="So sánh thuật toán"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[12px] font-bold text-ink">So sánh thuật toán</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Dijkstra & A* trên đồ thị OSM trung tâm TP.HCM</p>
        </div>
        <div className="flex rounded-lg bg-white p-0.5 shadow-sm" role="group" aria-label="Tiêu chí tối ưu">
          {objectives.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={objective === item.id}
              onClick={() => comparison.setObjective(item.id)}
              className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${objective === item.id ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:text-ink'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={!canRun || isLoading}
        onClick={() => void comparison.run()}
        className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white text-[11px] font-bold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
      >
        {isLoading ? (
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
            aria-hidden="true"
          />
        ) : (
          <Icon name="sparkles" size={15} />
        )}
        {isLoading ? 'Đang chạy thuật toán…' : 'Chạy Dijkstra & A*'}
      </button>

      {error && (
        <p
          className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] leading-4 text-amber-900"
          role="alert"
        >
          {error}
        </p>
      )}

      {result && (
        <div className="mt-3" aria-live="polite">
          <table className="w-full text-left text-[10px] text-slate-700">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 font-semibold">Thuật toán</th>
                <th className="font-semibold">Quãng đường</th>
                <th className="font-semibold">Thời gian*</th>
                <th className="text-right font-semibold">Node duyệt</th>
                <th className="text-right font-semibold">ms</th>
              </tr>
            </thead>
            <tbody>
              {result.runs.map((run) => (
                <tr key={run.algorithm} className="border-t border-slate-200">
                  <td className="py-1.5 font-bold text-ink">
                    <span
                      className={`mr-1.5 inline-block h-2 w-3 rounded-sm align-middle ${run.algorithm === 'astar' ? 'bg-orange-500' : 'bg-violet-500'}`}
                      aria-hidden="true"
                    />
                    {algorithmLabels[run.algorithm]}
                  </td>
                  <td>{formatDistanceMeters(run.distanceMeters)}</td>
                  <td>{formatDurationMinutes(run.durationSeconds / 60)}</td>
                  <td className="text-right font-semibold">{run.visitedNodes.toLocaleString('vi-VN')}</td>
                  <td className="text-right">{run.runtimeMs.toLocaleString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {saving !== null && (
            <p className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-[10px] font-semibold text-emerald-800">
              A* duyệt ít hơn {saving}% số node, cùng chi phí tối ưu.
            </p>
          )}
          <p className="mt-2 text-[9px] leading-4 text-slate-500">
            Điểm được gắn vào đường gần nhất (lệch {result.snappedFrom.offsetMeters} m /{' '}
            {result.snappedTo.offsetMeters} m). *Thời gian ước tính khi đường thông thoáng, chưa tính kẹt xe.
            Dữ liệu © OpenStreetMap.
          </p>
        </div>
      )}
    </section>
  );
}
