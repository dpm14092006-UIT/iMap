export const PHOTO_TYPES = 'image/jpeg,image/png,image/webp';
/** Metadata-only validation: no reading or uploading the attachment. */
export function photoError(file: { type: string; size: number }): string | null {
  if (!PHOTO_TYPES.split(',').includes(file.type)) return 'Ảnh phải có định dạng JPG, PNG hoặc WebP.';
  if (file.size > 5 * 1024 * 1024) return 'Ảnh tối đa 5 MB.';
  return null;
}
