import { useEffect, useState } from 'react';

/** Thời điểm hiện tại, cập nhật định kỳ (dùng cho thẻ "Khu vực này"). */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
