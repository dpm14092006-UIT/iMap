export interface AiVisionProvider {
  analyzeTraffic(image: Buffer): Promise<unknown>;
  recognizeSign(image: Buffer): Promise<unknown>;
}
