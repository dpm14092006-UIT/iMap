import { useCallback, useEffect, useRef, useState } from 'react';

const TOAST_DURATION_MS = 3200;

/** Thông báo ngắn ở giữa màn hình, tự ẩn sau vài giây. */
export function useToast() {
  const [message, setMessage] = useState('');
  const timer = useRef<number | undefined>(undefined);

  // Xóa hẹn giờ khi component bị hủy.
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const showToast = useCallback((text: string) => {
    setMessage(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(''), TOAST_DURATION_MS);
  }, []);

  return { toast: message, showToast };
}
