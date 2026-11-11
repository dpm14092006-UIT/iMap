/** Lỗi khi gọi API backend; `message` luôn là tiếng Việt, hiển thị được cho người dùng. */
export class ApiError extends Error {
  constructor(
    message: string,
    /** Mã HTTP; 0 nếu yêu cầu chưa tới được máy chủ (mất mạng, quá thời gian chờ). */
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Lỗi do máy chủ trả về (khác lỗi mạng/timeout). */
  get isServerError(): boolean {
    return this.status > 0;
  }
}
