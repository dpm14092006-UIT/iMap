/**
 * Chạy `run` khi trình duyệt rảnh (sau khi vẽ xong phần chính), chậm nhất sau `timeoutMs`.
 * Trình duyệt không có requestIdleCallback (Safari) thì chờ đúng `timeoutMs` như cũ.
 * Trả về hàm hủy.
 */
export function whenIdle(run: () => void, timeoutMs: number): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(run, { timeout: timeoutMs });
    return () => window.cancelIdleCallback(handle);
  }
  const timer = window.setTimeout(run, timeoutMs);
  return () => window.clearTimeout(timer);
}
