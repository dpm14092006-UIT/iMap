type HeapEntry<T> = { item: T; priority: number };

/**
 * Hàng đợi ưu tiên dạng binary min-heap: lấy phần tử có priority nhỏ nhất trong O(log n).
 * Dijkstra/A* dùng heap này thay cho việc quét toàn bộ tập mở (O(V)) ở mỗi bước.
 *
 * Không hỗ trợ "decrease-key": khi tìm được đường tốt hơn, ta push bản sao mới
 * và bỏ qua bản sao cũ lúc pop (kỹ thuật lazy deletion).
 */
export class MinHeap<T> {
  private readonly entries: HeapEntry<T>[] = [];

  get size(): number {
    return this.entries.length;
  }

  push(item: T, priority: number): void {
    this.entries.push({ item, priority });
    this.bubbleUp(this.entries.length - 1);
  }

  /** Lấy ra phần tử có priority nhỏ nhất, hoặc undefined nếu heap rỗng. */
  pop(): T | undefined {
    const top = this.entries[0];
    const last = this.entries.pop();
    if (top === undefined || last === undefined) return undefined;
    if (this.entries.length > 0) {
      this.entries[0] = last; // đưa phần tử cuối lên gốc rồi đẩy xuống đúng vị trí
      this.sinkDown(0);
    }
    return top.item;
  }

  /** Đẩy phần tử ở `index` lên trên khi nó nhỏ hơn cha. */
  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.priorityAt(parent) <= this.priorityAt(index)) return;
      this.swap(parent, index);
      index = parent;
    }
  }

  /** Đẩy phần tử ở `index` xuống dưới khi nó lớn hơn con nhỏ nhất. */
  private sinkDown(index: number): void {
    for (;;) {
      const left = 2 * index + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.entries.length && this.priorityAt(left) < this.priorityAt(smallest)) smallest = left;
      if (right < this.entries.length && this.priorityAt(right) < this.priorityAt(smallest)) smallest = right;
      if (smallest === index) return;
      this.swap(smallest, index);
      index = smallest;
    }
  }

  private priorityAt(index: number): number {
    return this.entries[index]!.priority;
  }

  private swap(a: number, b: number): void {
    [this.entries[a], this.entries[b]] = [this.entries[b]!, this.entries[a]!];
  }
}
