/**
 * Giới hạn số yêu cầu chạy song song trong một tiến trình, để một endpoint tốn phí
 * không bị dồn dập (hạn mức theo người dùng nằm ở FeatureQuotaGuard, cái này bảo vệ từng instance).
 */
export class ConcurrencyLimiter {
  private active = 0;

  constructor(private readonly max: number) {}

  /** Chạy `task` nếu còn chỗ; trả `undefined` nếu đang đầy (nơi gọi tự báo 429). Luôn nhả chỗ khi xong. */
  async run<T>(task: () => Promise<T>): Promise<{ value: T } | undefined> {
    if (this.active >= this.max) return undefined;
    this.active++;
    try {
      return { value: await task() };
    } finally {
      this.active--;
    }
  }
}
