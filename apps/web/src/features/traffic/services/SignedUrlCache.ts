/**
 * Nhớ link ảnh đã ký theo đường dẫn ảnh, để danh sách báo cáo cập nhật (realtime, kéo bản đồ) không phải
 * ký lại toàn bộ ảnh mỗi lần. Link chỉ được dùng lại khi còn hạn đủ lâu; ký lỗi thì không nhớ để lần sau thử lại.
 */
export class SignedUrlCache {
  private readonly entries = new Map<string, { url: Promise<string | null>; expiresAt: number }>();

  /**
   * @param sign Hàm ký link (gọi Supabase Storage).
   * @param reuseMs Dùng lại link trong bao lâu; đặt ngắn hơn hạn thật của link để không trả link sắp hết hạn.
   */
  constructor(
    private readonly sign: (path: string) => Promise<string | null>,
    private readonly reuseMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(path: string): Promise<string | null> {
    const cached = this.entries.get(path);
    if (cached && cached.expiresAt > this.now()) return cached.url;
    const evictIfCurrent = () => {
      if (this.entries.get(path)?.url === url) this.entries.delete(path);
    };
    const url = this.sign(path).then(
      (signed) => {
        if (!signed) evictIfCurrent();
        return signed;
      },
      (error: unknown) => {
        evictIfCurrent();
        throw error;
      },
    );
    this.entries.set(path, { url, expiresAt: this.now() + this.reuseMs });
    return url;
  }
}
