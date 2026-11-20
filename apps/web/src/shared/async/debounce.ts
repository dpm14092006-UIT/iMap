/** Hàm đã được "gom": gọi nhiều lần liên tiếp chỉ chạy một lần, sau khi im lặng `waitMs`. */
export type Debounced = (() => void) & {
  /** Hủy lần chạy đang chờ (dùng khi component bị gỡ). */
  cancel: () => void;
};

/** Gom các lần gọi dồn dập (ví dụ nhiều sự kiện realtime trong vài trăm ms) thành một lần chạy. */
export function debounce(run: () => void, waitMs: number): Debounced {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      run();
    }, waitMs);
  }) as Debounced;
  debounced.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  return debounced;
}
