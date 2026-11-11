/** Held–Karp on a directed road-cost matrix. Departure is always index 0; open tours have a free final stop. */
export class ExactTourStrategy {
  optimize(matrix: number[][], returnToStart = false): { order: number[]; cost: number } {
    const n = matrix.length;
    if (
      n < 2 ||
      n > 9 ||
      matrix.some((row) => row.length !== n || row.some((value) => Number.isNaN(value) || value < 0))
    )
      throw new Error('Ma trận chi phí không hợp lệ.');
    const m = n - 1,
      size = 1 << m;
    const dp = Array.from({ length: size }, () => Array<number>(m).fill(Infinity));
    const parent = Array.from({ length: size }, () => Array<number>(m).fill(-1));
    for (let j = 0; j < m; j++) dp[1 << j]![j] = matrix[0]![j + 1]!;
    for (let mask = 1; mask < size; mask++) {
      for (let j = 0; j < m; j++) {
        if (!(mask & (1 << j)) || !Number.isFinite(dp[mask]![j])) continue;
        for (let k = 0; k < m; k++) {
          if (mask & (1 << k)) continue;
          const next = mask | (1 << k),
            cost = dp[mask]![j]! + matrix[j + 1]![k + 1]!;
          if (cost < dp[next]![k]!) {
            dp[next]![k] = cost;
            parent[next]![k] = j;
          }
        }
      }
    }
    let best = Infinity,
      last = -1;
    for (let j = 0; j < m; j++) {
      const cost = dp[size - 1]![j]! + (returnToStart ? matrix[j + 1]![0]! : 0);
      if (cost < best) {
        best = cost;
        last = j;
      }
    }
    if (last === -1) throw new Error('Không có hành trình đi qua tất cả điểm đã chọn.');
    const reversed: number[] = [];
    let mask = size - 1;
    while (last !== -1) {
      reversed.push(last + 1);
      const previous = parent[mask]![last]!;
      mask ^= 1 << last;
      last = previous;
    }
    const order = [0, ...reversed.reverse(), ...(returnToStart ? [0] : [])];
    // Keep the original order on equal costs to avoid surprising reorderings.
    const baseline = [0, ...Array.from({ length: m }, (_, i) => i + 1), ...(returnToStart ? [0] : [])];
    const baselineCost = baseline.slice(1).reduce((sum, to, i) => sum + matrix[baseline[i]!]![to]!, 0);
    return baselineCost <= best ? { order: baseline, cost: baselineCost } : { order, cost: best };
  }
}
