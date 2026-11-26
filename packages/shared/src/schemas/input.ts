import { z } from 'zod';
import { isInVietmapCoverage } from '../constants.js';

/**
 * Tùy chọn cho refine/addIssue: thông báo được đánh dấu an toàn để API trả thẳng cho người dùng
 * (errorHandler dùng nó làm `message` thay cho "Dữ liệu không hợp lệ").
 */
export function publicMessage(message: string) {
  return { message, params: { publicMessage: true } };
}

export const outsideCoverageMessage = 'Vị trí nằm ngoài vùng bản đồ Việt Nam mà iMap hỗ trợ.';

/** Số thập phân thường: không nhận chuỗi rỗng, hex (0x..), số mũ (1e3), Infinity hay NaN. */
const plainDecimal = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

/**
 * Số trong query string (hoặc JSON): nhận number, hoặc chuỗi số thập phân thường rồi mới kiểm tra
 * phạm vi bằng `inner`. Thay cho `z.coerce.number()` vốn biến "" và " " thành 0, "0x0A" thành 10.
 */
export function strictNumber<T extends z.ZodType<number, number>>(inner: T) {
  return z
    .union([
      z.number(),
      z
        .string()
        .trim()
        // refine (không dùng .regex) để giữ params.publicMessage trong issue.
        .refine((value) => plainDecimal.test(value), publicMessage('Giá trị phải là số thập phân hợp lệ.'))
        .transform(Number),
    ])
    .pipe(inner);
}

/** Tọa độ phải nằm trong vùng VietMap hỗ trợ. */
export const vietnamPointSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .refine(isInVietmapCoverage, publicMessage(outsideCoverageMessage));
export type VietnamPoint = z.infer<typeof vietnamPointSchema>;

/** Hai tọa độ coi như trùng nhau (khoảng 0,1 m). */
export function samePoint(a: { lat: number; lng: number }, b: { lat: number; lng: number }): boolean {
  return Math.abs(a.lat - b.lat) <= 0.000001 && Math.abs(a.lng - b.lng) <= 0.000001;
}

/** Ký tự điều khiển (kể cả tab/xuống dòng): không bao giờ hợp lệ trong từ khóa tìm kiếm. */
const anyControlChar = /\p{Cc}/u;
/** Ký tự điều khiển trừ tab và xuống dòng: ghi chú nhiều dòng vẫn được. */
const controlCharExceptNewline = /[^\P{Cc}\t\n\r]/u;
const letterOrDigit = /[\p{L}\p{N}]/u;

/** Từ khóa tìm kiếm: đã trim, không có ký tự điều khiển, phải có ít nhất một chữ hoặc số. */
export function searchTextSchema(min: number, max: number) {
  return z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !anyControlChar.test(value), publicMessage('Từ khóa chứa ký tự không hợp lệ.'))
    .refine((value) => letterOrDigit.test(value), publicMessage('Từ khóa cần có ít nhất một chữ hoặc số.'));
}

/** Ghi chú tự do: chặn ký tự điều khiển (trừ xuống dòng), trim, chỉ toàn khoảng trắng thì coi như bỏ trống. */
export function noteTextSchema(max: number) {
  return z
    .string()
    .max(max)
    .refine(
      (value) => !controlCharExceptNewline.test(value),
      publicMessage('Ghi chú chứa ký tự không hợp lệ.'),
    )
    .transform((value) => value.trim() || undefined);
}

/** Mảng không có phần tử trùng. */
export function hasNoDuplicates(values: readonly unknown[]): boolean {
  return new Set(values).size === values.length;
}
