import { randomUUID } from 'node:crypto';
import { SupabaseClientFactory } from '../../../../shared/supabase/SupabaseClientFactory.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import type { AiImageStorage } from '../../application/ports/AiImageStorage.js';
import type { VisionImage } from '../../application/ports/AiVisionProvider.js';

const extensions: Record<VisionImage['mimeType'], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export class SupabaseAiImageStorage implements AiImageStorage {
  constructor(private readonly clients = new SupabaseClientFactory()) {}

  async save(image: VisionImage, userId: string, accessToken: string): Promise<string> {
    const path = `${userId}/${randomUUID()}.${extensions[image.mimeType]}`;
    const { error } = await this.clients.create(accessToken).storage.from('traffic-images').upload(path, image.bytes, {
      contentType: image.mimeType,
      cacheControl: '3600',
      upsert: false,
    });
    if (error) {
      console.error('Supabase image storage failed', { code: error.name });
      throw new AppError(503, 'IMAGE_STORAGE_UNAVAILABLE', 'Không thể lưu ảnh riêng tư lúc này');
    }
    return path;
  }

  async remove(path: string, accessToken: string): Promise<void> {
    const { error } = await this.clients.create(accessToken).storage.from('traffic-images').remove([path]);
    if (error) console.error('Supabase image cleanup failed', { code: error.name });
  }
}
