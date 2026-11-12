import { MAX_OPTIMIZE_POINTS, type OptimizeRouteRequest } from '@routetwin/shared';

/** Lựa chọn thuật toán trong panel nhiều điểm. */
export type AlgorithmChoice = OptimizeRouteRequest['algorithm'];

/** Số điểm ghé tối đa (không tính điểm xuất phát). */
export const MAX_STOPS = MAX_OPTIMIZE_POINTS - 1;

export const algorithmOptions: { id: AlgorithmChoice; label: string }[] = [
  { id: 'auto', label: 'Tự động' },
  { id: 'exact', label: 'Chính xác (Held–Karp)' },
  { id: 'heuristic', label: 'Nhanh (NN + 2-opt)' },
];

/** Tên hiển thị của thuật toán backend đã thực sự dùng. */
export const usedAlgorithmLabels = {
  exact: 'Held–Karp · tối ưu chính xác',
  heuristic: 'NN + 2-opt · gần đúng',
} as const;
