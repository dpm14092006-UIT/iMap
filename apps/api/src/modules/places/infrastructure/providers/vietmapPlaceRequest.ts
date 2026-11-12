import { AppError } from '../../../../shared/errors/AppError.js';

export type VietmapPlaceEndpoint = 'autocomplete' | 'search' | 'place' | 'reverse';

export function invalidPlaceResponse() {
  return new AppError(502, 'PLACE_SEARCH_INVALID_RESPONSE', 'VietMap trả về dữ liệu địa điểm không hợp lệ.');
}

/** Gọi VietMap Place API v4 và đổi mọi lỗi sang AppError tiếng Việt, không để lộ key. */
export async function requestVietmapPlaces(
  apiKey: string | undefined,
  endpoint: VietmapPlaceEndpoint,
  params: Record<string, string>,
): Promise<unknown> {
  if (!apiKey)
    throw new AppError(503, 'PLACE_SEARCH_NOT_CONFIGURED', 'Chưa cấu hình VietMap Search ở máy chủ.');
  const url = new URL(`https://maps.vietmap.vn/api/${endpoint}/v4`);
  url.search = new URLSearchParams({ ...params, apikey: apiKey }).toString();
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new AppError(502, 'PLACE_SEARCH_UNAVAILABLE', 'Không kết nối được VietMap Search. Hãy thử lại.');
  }
  if (response.status === 401 || response.status === 403)
    throw new AppError(502, 'PLACE_SEARCH_AUTH', 'Key VietMap chưa được cấp quyền tìm địa điểm.');
  if (response.status === 429 || response.status === 423)
    throw new AppError(429, 'PLACE_SEARCH_QUOTA', 'VietMap Search đã đạt hạn mức hoặc chưa được bật.');
  if (!response.ok)
    throw new AppError(502, 'PLACE_SEARCH_UNAVAILABLE', 'VietMap Search đang bận. Hãy thử lại.');
  try {
    return await response.json();
  } catch {
    throw invalidPlaceResponse();
  }
}
