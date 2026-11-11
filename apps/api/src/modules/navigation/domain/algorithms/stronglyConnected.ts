/**
 * Tìm thành phần liên thông mạnh (SCC) lớn nhất của đồ thị có hướng bằng thuật toán Kosaraju.
 *
 * SCC là tập node mà từ bất kỳ node nào cũng đi tới được mọi node còn lại.
 * Dùng để loại các "đảo" đường bị cô lập (bãi xe, đường một chiều cụt ở mép vùng dữ liệu):
 * nếu chỉ snap điểm đầu/cuối vào SCC lớn nhất thì luôn tìm được đường.
 *
 * Viết dạng vòng lặp (không đệ quy) để không tràn stack với đồ thị hàng chục nghìn node.
 */
export function largestStronglyConnectedComponent(
  nodeIds: string[],
  neighbors: (id: string) => string[],
): Set<string> {
  // Đồ thị đảo chiều: cần cho lượt duyệt thứ hai.
  const reversed = new Map<string, string[]>(nodeIds.map((id) => [id, []]));
  for (const id of nodeIds) for (const next of neighbors(id)) reversed.get(next)?.push(id);

  // Lượt 1: DFS trên đồ thị gốc, ghi thứ tự node "hoàn thành".
  const finishOrder: string[] = [];
  const visited = new Set<string>();
  for (const root of nodeIds) {
    if (visited.has(root)) continue;
    visited.add(root);
    const stack: { id: string; next: string[]; index: number }[] = [
      { id: root, next: neighbors(root), index: 0 },
    ];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const child = frame.next[frame.index++];
      if (child === undefined) {
        finishOrder.push(frame.id); // đã duyệt hết con
        stack.pop();
      } else if (!visited.has(child)) {
        visited.add(child);
        stack.push({ id: child, next: neighbors(child), index: 0 });
      }
    }
  }

  // Lượt 2: duyệt đồ thị đảo theo thứ tự hoàn thành giảm dần; mỗi lần duyệt được đúng một SCC.
  const assigned = new Set<string>();
  let largest = new Set<string>();
  for (let i = finishOrder.length - 1; i >= 0; i--) {
    const root = finishOrder[i]!;
    if (assigned.has(root)) continue;
    const component = new Set<string>([root]);
    assigned.add(root);
    const stack = [root];
    while (stack.length > 0) {
      for (const previous of reversed.get(stack.pop()!) ?? []) {
        if (assigned.has(previous)) continue;
        assigned.add(previous);
        component.add(previous);
        stack.push(previous);
      }
    }
    if (component.size > largest.size) largest = component;
  }
  return largest;
}
