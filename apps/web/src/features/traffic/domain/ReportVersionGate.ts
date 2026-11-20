/**
 * Cho mỗi phiên bản của một báo cáo đi qua đúng một lần (Realtime và Web Push có thể gửi trùng).
 * Nhớ tối đa `capacity` báo cáo; vượt thì quên báo cáo cũ nhất.
 */
export class ReportVersionGate {
  private readonly seen = new Map<string, number>();

  constructor(private readonly capacity = 120) {}

  /** true nếu báo cáo (id, version) chưa từng qua cổng; khi đó ghi nhớ luôn. */
  admit(id: string, version = 1): boolean {
    if ((this.seen.get(id) ?? 0) >= version) return false;
    this.seen.set(id, version);
    if (this.seen.size > this.capacity) {
      const oldest = this.seen.keys().next().value;
      if (oldest) this.seen.delete(oldest);
    }
    return true;
  }
}
