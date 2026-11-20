import { describe, expect, it } from 'vitest';
import { shouldCheckForUpdate } from './useAppUpdate';

describe('shouldCheckForUpdate (review #22)', () => {
  it('đã biết có bản mới thì thôi hỏi máy chủ', () => {
    expect(shouldCheckForUpdate(true, 'visible')).toBe(false);
  });

  it('tab ẩn thì không hỏi; tab đang xem và chưa có bản mới thì hỏi', () => {
    expect(shouldCheckForUpdate(false, 'hidden')).toBe(false);
    expect(shouldCheckForUpdate(false, 'visible')).toBe(true);
  });
});
