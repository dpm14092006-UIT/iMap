const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';
export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(endpoint:string, init?:RequestInit, accessToken?:string): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof Blob) && !(init.body instanceof ArrayBuffer) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Accept', 'application/json');
  const res = await fetch(`${BASE}${endpoint}`, {
    ...init,
    headers,
  });
  const json:unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const apiError = typeof json === 'object' && json !== null && 'error' in json
      ? (json as {error:{message?:string;code?:string}}).error : {};
    throw new ApiError(apiError.message ?? `Lỗi API (${res.status})`, res.status, apiError.code);
  }
  if (typeof json !== 'object' || json === null || !('data' in json)) throw new ApiError('Phản hồi API không hợp lệ', res.status);
  return (json as {data:T}).data;
}
