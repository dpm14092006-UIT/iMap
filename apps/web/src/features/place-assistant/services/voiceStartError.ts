/** Giai đoạn bắt đầu ghi âm bị lỗi: xin quyền micro (getUserMedia) hay tạo/chạy MediaRecorder. */
export type VoiceStartStage = 'microphone' | 'recorder';

/**
 * Thông báo lỗi đúng nguyên nhân khi bắt đầu ghi âm. Trước đây mọi lỗi đều báo "chưa được cấp quyền micro",
 * kể cả khi micro đã được cấp nhưng trình duyệt không tạo được bộ ghi âm.
 */
export function voiceStartErrorMessage(cause: unknown, stage: VoiceStartStage): string {
  if (stage === 'recorder') {
    return 'Trình duyệt này không ghi âm được (MediaRecorder lỗi). Hãy thử trình duyệt khác hoặc nhập chữ.';
  }
  const name = cause instanceof DOMException ? cause.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Chưa được cấp quyền micro. Hãy cho phép micro trong cài đặt trình duyệt (cần HTTPS).';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'Không tìm thấy micro trên thiết bị này.';
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'Micro đang được ứng dụng khác dùng. Hãy đóng ứng dụng đó rồi thử lại.';
  }
  return 'Chưa được cấp quyền micro hoặc không có thiết bị. Kiểm tra quyền micro và dùng HTTPS.';
}
