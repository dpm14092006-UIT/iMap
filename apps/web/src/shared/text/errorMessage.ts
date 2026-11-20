/** Thông điệp của lỗi để hiển thị cho người dùng; lỗi không phải `Error` thì dùng `fallback`. */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
