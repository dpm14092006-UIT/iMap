import { ApiError } from '../../../shared/api/ApiError';

const messages: Record<string, string> = {
  PLACE_SEARCH_NOT_CONFIGURED: 'Máy chủ chưa cấu hình khóa VietMap nên chưa tìm được địa điểm.',
  PLACE_SEARCH_AUTH: 'Khóa VietMap chưa được cấp quyền tìm địa điểm.',
  PLACE_SEARCH_QUOTA: 'VietMap đã hết hạn mức tìm địa điểm. Hãy thử lại sau.',
  PLACE_SEARCH_UNAVAILABLE: 'VietMap đang bận. Hãy thử lại sau ít phút.',
  PLACE_SEARCH_INVALID_RESPONSE: 'VietMap trả về dữ liệu không hợp lệ. Hãy thử lại.',
  POI_SEARCH_BUSY: 'Đang có nhiều lượt tìm cùng lúc. Hãy thử lại sau vài giây.',
  VALIDATION_ERROR: 'Yêu cầu tìm kiếm không hợp lệ. Hãy đổi từ khóa hoặc bán kính.',
};

/** Thông điệp tiếng Việt theo mã lỗi của backend; lỗi mạng/timeout dùng thông điệp có sẵn của ApiError. */
export function poiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const byCode = error.code ? messages[error.code] : undefined;
    if (byCode) return byCode;
    if (!error.isServerError) return error.message;
  }
  return 'Không tải được danh sách địa điểm. Hãy thử lại.';
}
