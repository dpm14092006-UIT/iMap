import { describe, expect, it } from 'vitest';
import { largestStronglyConnectedComponent } from './stronglyConnected.js';

/** Tạo hàm neighbors từ danh sách cạnh dạng "A>B". */
function edges(list: string[]) {
  const map = new Map<string, string[]>();
  for (const pair of list) {
    const [from, to] = pair.split('>') as [string, string];
    map.set(from, [...(map.get(from) ?? []), to]);
  }
  return (id: string) => map.get(id) ?? [];
}

describe('largestStronglyConnectedComponent', () => {
  it('bỏ node chỉ đi vào được mà không đi ra được (đường một chiều cụt)', () => {
    // A <-> B <-> C là vòng chính; C -> D một chiều cụt; E -> A chỉ đi vào.
    const neighbors = edges(['A>B', 'B>A', 'B>C', 'C>B', 'C>D', 'E>A']);
    expect([...largestStronglyConnectedComponent(['A', 'B', 'C', 'D', 'E'], neighbors)].sort()).toEqual([
      'A',
      'B',
      'C',
    ]);
  });

  it('chọn thành phần lớn nhất khi có nhiều đảo', () => {
    const neighbors = edges(['A>B', 'B>A', 'X>Y', 'Y>Z', 'Z>X']);
    expect([...largestStronglyConnectedComponent(['A', 'B', 'X', 'Y', 'Z'], neighbors)].sort()).toEqual([
      'X',
      'Y',
      'Z',
    ]);
  });

  it('không tràn stack với chuỗi dài', () => {
    const ids = Array.from({ length: 50_000 }, (_, i) => String(i));
    // Vòng tròn 0 -> 1 -> ... -> 49999 -> 0
    const neighbors = (id: string) => [String((Number(id) + 1) % ids.length)];
    expect(largestStronglyConnectedComponent(ids, neighbors).size).toBe(50_000);
  });
});
