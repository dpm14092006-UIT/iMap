export type SupportedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';
export type VisionImage = { bytes: Buffer; mimeType: SupportedImageMime };
export type VisionResult = { result: Record<string, unknown>; model: string };

export interface AiVisionProvider {
  analyzeTraffic(image: VisionImage): Promise<VisionResult>;
  recognizeSign(image: VisionImage): Promise<VisionResult>;
}
