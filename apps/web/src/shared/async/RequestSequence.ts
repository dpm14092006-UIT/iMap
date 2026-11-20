/**
 * Đánh số các yêu cầu bất đồng bộ theo từng "kênh" (ví dụ điểm đi / điểm đến) để chỉ kết quả của
 * yêu cầu MỚI NHẤT được dùng. Yêu cầu cũ về chậm hơn sẽ bị bỏ qua thay vì ghi đè lựa chọn mới.
 */
export class RequestSequence<Key extends string> {
  private readonly latest = new Map<Key, number>();

  /** Bắt đầu một yêu cầu mới trên kênh `key`; trả về số thứ tự của nó. */
  next(key: Key): number {
    const id = (this.latest.get(key) ?? 0) + 1;
    this.latest.set(key, id);
    return id;
  }

  /** Yêu cầu `id` có còn là yêu cầu mới nhất của kênh không. */
  isLatest(key: Key, id: number): boolean {
    return this.latest.get(key) === id;
  }
}
