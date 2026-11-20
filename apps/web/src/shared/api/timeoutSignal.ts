/** Tín hiệu hủy có hẹn giờ, kèm cách biết hủy là do quá giờ và dọn bộ hẹn giờ khi xong. */
export type TimeoutSignal = {
  signal: AbortSignal;
  /** true nếu bị hủy vì quá `timeoutMs` (không phải do nơi gọi hủy). */
  timedOut: () => boolean;
  /** Gọi khi request xong để bỏ bộ hẹn giờ và listener. */
  dispose: () => void;
};

/**
 * Gộp tín hiệu hủy của nơi gọi (nếu có) với hẹn giờ `timeoutMs`.
 * Tự làm bằng AbortController + setTimeout thay vì AbortSignal.any/AbortSignal.timeout,
 * vì Safari iOS < 17.4 chưa có AbortSignal.any (trước đây timeout bị bỏ → request treo, UI quay mãi).
 */
export function timeoutSignal(timeoutMs: number, signal?: AbortSignal | null): TimeoutSignal {
  const controller = new AbortController();
  let expired = false;
  const timer = setTimeout(() => {
    expired = true;
    controller.abort(new DOMException('Request timed out', 'TimeoutError'));
  }, timeoutMs);
  const forwardAbort = () => controller.abort(signal?.reason);

  if (signal?.aborted) forwardAbort();
  else signal?.addEventListener('abort', forwardAbort, { once: true });

  return {
    signal: controller.signal,
    timedOut: () => expired,
    dispose: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forwardAbort);
    },
  };
}
