import type { VisionImage } from './AiVisionProvider.js';

export interface AiImageStorage {
  save(image: VisionImage, userId: string, accessToken: string): Promise<string>;
  remove(path: string, accessToken: string): Promise<void>;
}
