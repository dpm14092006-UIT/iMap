const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';
export async function apiRequest<T>(endpoint:string, init?:RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${endpoint}`, {
    ...init,
    headers:{'Content-Type':'application/json',...init?.headers},
  });
  const json:unknown = await res.json();
  if (!res.ok) {
    const message = typeof json === 'object' && json !== null && 'error' in json
      ? String((json as {error:{message?:string}}).error.message ?? 'Lỗi API') : 'Lỗi API';
    throw new Error(message);
  }
  return (json as {data:T}).data;
}
