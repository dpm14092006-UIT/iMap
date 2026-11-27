import { ApiError } from './ApiError';
import { timeoutSignal } from './timeoutSignal';

export type HttpClientOptions = {
  /** Tiền tố của mọi endpoint, ví dụ "/api". */
  baseUrl: string;
  /** Quá thời gian này mà API chưa trả lời thì báo lỗi thay vì để giao diện chờ mãi. */
  timeoutMs: number;
};

/** Thông tin bổ sung cho một yêu cầu. */
export type RequestOptions = Omit<RequestInit, 'body' | 'method'> & {
  /** Access token của Supabase, gửi qua header Authorization. */
  accessToken?: string;
};

/**
 * Nguồn access token còn hạn (do tầng auth cung cấp). Token mà nơi gọi truyền vào lấy từ state React,
 * có thể đã hết hạn nếu máy ngủ hoặc tab chạy nền lâu khiến SDK chưa kịp tự làm mới.
 */
export type AccessTokenProvider = {
  /** Token hiện tại, tự làm mới nếu đã hết hạn; null nếu không còn phiên. */
  current(): Promise<string | null>;
  /** Bắt buộc làm mới phiên ngay (dùng khi máy chủ từ chối token); null nếu không làm mới được. */
  refresh(): Promise<string | null>;
};

/** Retry-After là số giây hoặc ngày giờ HTTP; trả về số giây (làm tròn lên, tối thiểu 1) hoặc undefined. */
function parseRetryAfterSeconds(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1, Math.ceil(seconds));
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(1, Math.ceil((date - Date.now()) / 1000));
}

/**
 * Lớp duy nhất của web nói chuyện HTTP với backend.
 * Mọi API client (places, traffic, routes…) nhận một HttpClient qua constructor,
 * nên có thể thay bằng bản giả khi kiểm thử và chỉ cần sửa một chỗ khi đổi cách gọi API.
 *
 * Backend luôn trả phong bì `{ data }` hoặc `{ error: { code, message } }`; lớp này bóc phong bì
 * và đổi mọi lỗi (HTTP, mất mạng, quá thời gian) thành `ApiError`. Yêu cầu bị chính nơi gọi hủy
 * (AbortController) thì giữ nguyên `AbortError`.
 */
export class HttpClient {
  private tokenProvider: AccessTokenProvider | null = null;

  constructor(private readonly options: HttpClientOptions) {}

  /** Tầng auth đăng ký nguồn token để mọi yêu cầu cần đăng nhập luôn gửi token còn hạn. */
  setAccessTokenProvider(provider: AccessTokenProvider | null): void {
    this.tokenProvider = provider;
  }

  get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.send<T>(endpoint, 'GET', undefined, options);
  }

  /** Gửi JSON, hoặc gửi nguyên Blob/ArrayBuffer (ví dụ ảnh, âm thanh) nếu `body` là dữ liệu nhị phân. */
  post<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.send<T>(endpoint, 'POST', body, options);
  }

  private async send<T>(
    endpoint: string,
    method: 'GET' | 'POST',
    body: unknown,
    { accessToken, ...init }: RequestOptions,
  ): Promise<T> {
    if (!accessToken || !this.tokenProvider)
      return this.attempt<T>(endpoint, method, body, init, accessToken);
    const token = (await this.freshToken(() => this.tokenProvider!.current())) ?? accessToken;
    try {
      return await this.attempt<T>(endpoint, method, body, init, token);
    } catch (error) {
      // Máy chủ từ chối phiên: làm mới một lần rồi gửi lại; vẫn lỗi thì báo lỗi gốc.
      if (!(error instanceof ApiError) || error.code !== 'INVALID_SESSION' || init.signal?.aborted)
        throw error;
      const refreshed = await this.freshToken(() => this.tokenProvider!.refresh());
      if (!refreshed || refreshed === token) throw error;
      return this.attempt<T>(endpoint, method, body, init, refreshed);
    }
  }

  /** Lỗi khi hỏi tầng auth (mất mạng…) không được chặn yêu cầu: trả null để dùng token sẵn có. */
  private async freshToken(read: () => Promise<string | null>): Promise<string | null> {
    try {
      return await read();
    } catch {
      return null;
    }
  }

  private async attempt<T>(
    endpoint: string,
    method: 'GET' | 'POST',
    body: unknown,
    init: Omit<RequestOptions, 'accessToken'>,
    accessToken: string | undefined,
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    const payload = this.encodeBody(body, headers);

    // Hẹn giờ phủ cả lúc chờ header lẫn lúc đọc nội dung phản hồi (như AbortSignal.timeout trước đây):
    // server gửi header rồi treo giữa chừng thì request vẫn dừng sau timeoutMs.
    const timeout = timeoutSignal(this.options.timeoutMs, init.signal);
    try {
      let response: Response;
      try {
        response = await fetch(`${this.options.baseUrl}${endpoint}`, {
          ...init,
          method,
          headers,
          body: payload,
          signal: timeout.signal,
        });
      } catch (cause) {
        throw this.toTransportError(cause, init.signal, timeout.timedOut());
      }
      try {
        return await this.unwrap<T>(response);
      } catch (cause) {
        // Quá giờ khi đang đọc nội dung: báo TIMEOUT thay vì "phản hồi không hợp lệ".
        if (timeout.timedOut()) throw this.toTransportError(cause, init.signal, true);
        throw cause;
      }
    } finally {
      timeout.dispose();
    }
  }

  private encodeBody(body: unknown, headers: Headers): BodyInit | undefined {
    if (body === undefined) return undefined;
    if (body instanceof Blob || body instanceof ArrayBuffer) return body;
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return JSON.stringify(body);
  }

  private toTransportError(
    cause: unknown,
    signal: AbortSignal | null | undefined,
    timedOut: boolean,
  ): unknown {
    if (signal?.aborted) return cause;
    // Trình duyệt cũ có thể báo AbortError chung chung khi quá giờ, nên dựa vào cờ timedOut.
    if (timedOut || (cause instanceof DOMException && cause.name === 'TimeoutError')) {
      return new ApiError('Máy chủ phản hồi quá lâu. Hãy thử lại.', 0, 'TIMEOUT');
    }
    return new ApiError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', 0, 'NETWORK');
  }

  private async unwrap<T>(response: Response): Promise<T> {
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const apiError =
        typeof json === 'object' && json !== null && 'error' in json
          ? (json as { error: { message?: string; code?: string } }).error
          : {};
      if (response.status === 429) {
        const retryAfter = parseRetryAfterSeconds(response.headers.get('Retry-After'));
        const message =
          retryAfter === undefined
            ? (apiError.message ?? 'Bạn thao tác quá nhanh, hãy thử lại sau ít giây.')
            : `Bạn thao tác quá nhanh, thử lại sau ${retryAfter} giây.`;
        throw new ApiError(message, 429, apiError.code, retryAfter);
      }
      throw new ApiError(apiError.message ?? `Lỗi API (${response.status})`, response.status, apiError.code);
    }
    if (typeof json !== 'object' || json === null || !('data' in json)) {
      throw new ApiError('Phản hồi API không hợp lệ', response.status);
    }
    return (json as { data: T }).data;
  }
}

/** HttpClient dùng chung của ứng dụng, trỏ tới API cấu hình bằng VITE_API_BASE_URL. */
export const httpClient = new HttpClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeoutMs: 45_000,
});
