const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';
/** Quá thời gian này mà API chưa trả lời thì báo lỗi thay vì để giao diện chờ mãi. */
const REQUEST_TIMEOUT_MS = 45_000;

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
}

function withTimeout(signal?: AbortSignal | null): AbortSignal | undefined {
  if (typeof AbortSignal.timeout !== 'function') return signal ?? undefined;
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal && typeof AbortSignal.any === 'function'
    ? AbortSignal.any([signal, timeout])
    : (signal ?? timeout);
}

/**
 * Gọi API của backend và trả về phần `data` trong phong bì `{ data }`.
 * Mọi lỗi (HTTP, mất mạng, quá thời gian) đều ném `ApiError` với thông báo tiếng Việt;
 * riêng yêu cầu bị nơi gọi chủ động hủy thì giữ nguyên `AbortError`.
 */
export async function apiRequest<T>(endpoint: string, init?: RequestInit, accessToken?: string): Promise<T> {
  const headers = new Headers(init?.headers);
  const hasJsonBody = init?.body && !(init.body instanceof Blob) && !(init.body instanceof ArrayBuffer);
  if (hasJsonBody && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Accept', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${BASE}${endpoint}`, { ...init, headers, signal: withTimeout(init?.signal) });
  } catch (cause) {
    if (init?.signal?.aborted) throw cause;
    if (cause instanceof DOMException && cause.name === 'TimeoutError') {
      throw new ApiError('Máy chủ phản hồi quá lâu. Hãy thử lại.', 0, 'TIMEOUT');
    }
    throw new ApiError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', 0, 'NETWORK');
  }

  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const apiError =
      typeof json === 'object' && json !== null && 'error' in json
        ? (json as { error: { message?: string; code?: string } }).error
        : {};
    throw new ApiError(apiError.message ?? `Lỗi API (${response.status})`, response.status, apiError.code);
  }
  if (typeof json !== 'object' || json === null || !('data' in json)) {
    throw new ApiError('Phản hồi API không hợp lệ', response.status);
  }
  return (json as { data: T }).data;
}
