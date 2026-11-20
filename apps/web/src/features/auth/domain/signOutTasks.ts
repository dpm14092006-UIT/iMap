/** Việc cần làm khi tài khoản sắp đăng xuất (lúc vẫn còn phiên đăng nhập để gọi Supabase). */
export type SignOutTask = () => Promise<void>;

/** Mạng chậm thì không để việc dọn dẹp chặn nút đăng xuất quá lâu. */
export const SIGN_OUT_TASK_TIMEOUT_MS = 3_000;

/**
 * Chạy song song mọi việc trước khi đăng xuất. Lỗi của từng việc bị bỏ qua và cả nhóm
 * dừng chờ sau `timeoutMs`: đăng xuất luôn phải xong, dọn dẹp chỉ là cố gắng tốt nhất.
 */
export async function runSignOutTasks(
  tasks: Iterable<SignOutTask>,
  timeoutMs = SIGN_OUT_TASK_TIMEOUT_MS,
): Promise<void> {
  const all = Promise.allSettled([...tasks].map((task) => Promise.resolve().then(task))).then(
    () => undefined,
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  await Promise.race([all, timeout]);
  clearTimeout(timer);
}
