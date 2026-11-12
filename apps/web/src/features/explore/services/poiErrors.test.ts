import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../shared/api/ApiError';
import { poiErrorMessage } from './poiErrors';

describe('poiErrorMessage', () => {
  it('đổi mã lỗi của backend sang thông điệp tiếng Việt', () => {
    expect(poiErrorMessage(new ApiError('x', 503, 'PLACE_SEARCH_NOT_CONFIGURED'))).toContain('chưa cấu hình');
    expect(poiErrorMessage(new ApiError('x', 429, 'PLACE_SEARCH_QUOTA'))).toContain('hết hạn mức');
  });
  it('429 chung (rate limit) giữ thông điệp thời gian chờ', () => {
    const message = 'Bạn thao tác quá nhanh, thử lại sau 5 giây.';
    expect(poiErrorMessage(new ApiError(message, 429, 'RATE_LIMITED', 5))).toBe(message);
  });
  it('lỗi mạng giữ thông điệp có sẵn; lỗi lạ dùng thông điệp chung', () => {
    expect(poiErrorMessage(new ApiError('Không kết nối được máy chủ.', 0, 'NETWORK'))).toBe(
      'Không kết nối được máy chủ.',
    );
    expect(poiErrorMessage(new Error('boom'))).toContain('Không tải được');
    expect(poiErrorMessage(new ApiError('lỗi', 500))).toContain('Không tải được');
  });
});
