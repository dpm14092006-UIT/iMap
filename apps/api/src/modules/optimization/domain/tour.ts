/** Các hàm dùng chung cho mọi thuật toán sắp xếp điểm ghé. */

/** Kiểm tra ma trận vuông, không âm, không NaN (Infinity hợp lệ = không có đường). */
export function assertValidMatrix(matrix: number[][]): void {
  const n = matrix.length;
  if (
    n < 2 ||
    matrix.some((row) => row.length !== n || row.some((value) => Number.isNaN(value) || value < 0))
  ) {
    throw new Error('Ma trận chi phí không hợp lệ.');
  }
}

/** Tổng chi phí khi đi lần lượt theo `order` (cộng chi phí từng cặp điểm liên tiếp). */
export function tourCost(matrix: number[][], order: number[]): number {
  let cost = 0;
  for (let i = 0; i + 1 < order.length; i++) cost += matrix[order[i]!]![order[i + 1]!]!;
  return cost;
}

/** Thứ tự người dùng nhập (0, 1, 2, …), dùng làm mốc so sánh "trước khi tối ưu". */
export function inputOrder(pointCount: number, returnToStart: boolean): number[] {
  return [...Array.from({ length: pointCount }, (_, i) => i), ...(returnToStart ? [0] : [])];
}

/**
 * Tìm điểm bị cô lập (ví dụ nằm trong khu phố đi bộ). Trả về danh sách index; rỗng nếu không có.
 * - Điểm xuất phát (0) phải ĐI RA được; nếu quay về thì còn phải ĐI TỚI được.
 * - Điểm ghé phải ĐI TỚI được; chỉ bắt buộc ĐI RA được khi quay về điểm xuất phát
 *   (với hành trình mở, điểm ghé cuối cùng không cần đi tiếp).
 */
export function findIsolatedPoints(matrix: number[][], returnToStart: boolean): number[] {
  const isolated: number[] = [];
  for (let i = 0; i < matrix.length; i++) {
    const others = matrix.map((_, j) => j).filter((j) => j !== i);
    const canLeave = others.some((j) => Number.isFinite(matrix[i]![j]!));
    const canArrive = others.some((j) => Number.isFinite(matrix[j]![i]!));
    const mustLeave = i === 0 || returnToStart;
    const mustArrive = i !== 0 || returnToStart;
    if ((mustLeave && !canLeave) || (mustArrive && !canArrive)) isolated.push(i);
  }
  return isolated;
}
