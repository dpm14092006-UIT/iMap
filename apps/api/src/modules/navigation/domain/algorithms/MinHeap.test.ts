import { describe, expect, it } from 'vitest';
import { MinHeap } from './MinHeap.js';

describe('MinHeap', () => {
  it('luôn lấy ra phần tử có priority nhỏ nhất', () => {
    const heap = new MinHeap<string>();
    [
      ['e', 5],
      ['a', 1],
      ['d', 4],
      ['b', 2],
      ['c', 3],
    ].forEach(([item, priority]) => heap.push(item as string, priority as number));
    const order: string[] = [];
    while (heap.size > 0) order.push(heap.pop()!);
    expect(order).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('trả undefined khi rỗng', () => {
    expect(new MinHeap<number>().pop()).toBeUndefined();
  });

  it('sắp xếp đúng với nhiều số ngẫu nhiên', () => {
    const heap = new MinHeap<number>();
    const values = Array.from({ length: 500 }, (_, i) => (i * 7919) % 1000);
    values.forEach((value) => heap.push(value, value));
    const popped = values.map(() => heap.pop()!);
    expect(popped).toEqual([...values].sort((a, b) => a - b));
  });
});
