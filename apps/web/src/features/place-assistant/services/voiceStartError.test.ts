import { describe, expect, it } from 'vitest';
import { voiceStartErrorMessage } from './voiceStartError';

describe('voiceStartErrorMessage (review #15)', () => {
  it('lỗi tạo MediaRecorder không bị báo nhầm là thiếu quyền micro', () => {
    const message = voiceStartErrorMessage(new DOMException('bad mime', 'NotSupportedError'), 'recorder');
    expect(message).toContain('MediaRecorder');
    expect(message).not.toContain('quyền micro');
  });

  it('phân biệt bị từ chối quyền, không có micro và micro đang bận', () => {
    expect(voiceStartErrorMessage(new DOMException('', 'NotAllowedError'), 'microphone')).toContain(
      'Chưa được cấp quyền micro',
    );
    expect(voiceStartErrorMessage(new DOMException('', 'NotFoundError'), 'microphone')).toContain(
      'Không tìm thấy micro',
    );
    expect(voiceStartErrorMessage(new DOMException('', 'NotReadableError'), 'microphone')).toContain(
      'ứng dụng khác',
    );
  });

  it('lỗi lạ khi xin micro giữ thông báo chung như cũ', () => {
    expect(voiceStartErrorMessage(new Error('?'), 'microphone')).toContain('Kiểm tra quyền micro');
  });
});
