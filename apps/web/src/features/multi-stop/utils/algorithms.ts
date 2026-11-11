import { MAX_OPTIMIZE_POINTS, type OptimizeRouteRequest } from '@routetwin/shared';

/** Lựa chọn thuật toán trong panel nhiều điểm. */
export type AlgorithmChoice = OptimizeRouteRequest['algorithm'];

/** Số điểm ghé tối đa (không tính điểm xuất phát). */
export const MAX_STOPS = MAX_OPTIMIZE_POINTS - 1;
/** Held–Karp chạy nhanh (≈ 30 ms) cho toàn bộ giới hạn điểm ghé của app. */
export const MAX_EXACT_STOPS = MAX_STOPS;

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
