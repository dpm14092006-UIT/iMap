import { GoogleGenAI } from '@google/genai';
import { trafficImageAnalysisSchema, trafficSignRecognitionSchema } from '@routetwin/shared';
import { env } from '../../../../config/env.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import type { AiVisionProvider, VisionImage, VisionResult } from '../../application/ports/AiVisionProvider.js';

const unknownTrafficResult = trafficImageAnalysisSchema.parse({
  status: 'unclear', incidentType: null, severity: null,
  description: 'Ảnh chưa đủ rõ để xác định tình huống.', confidence: 0, evidence: 'Không có kết quả phân tích đáng tin cậy.',
});
const unknownSignResult = trafficSignRecognitionSchema.parse({
  recognized: false, text: null, category: 'unknown', confidence: 0,
  description: 'Không thể nhận diện biển báo một cách đáng tin cậy.',
});

export class GeminiVisionProvider implements AiVisionProvider {
  private readonly model = env.GEMINI_MODEL ?? 'gemini-3.8-flash';

  async analyzeTraffic(image: VisionImage): Promise<VisionResult> {
    const result = await this.generate(image, [
      'Phân tích ảnh giao thông tại Việt Nam. Trả JSON đúng schema đã yêu cầu.',
      'Chỉ mô tả điều nhìn thấy trong khung hình. Ảnh tĩnh không chứng minh được tốc độ, ùn tắc kéo dài, nguyên nhân, hoặc tình trạng hiện tại.',
      'Nếu không chắc chắn, chọn status="unclear", incidentType=null, severity=null và confidence thấp. Không suy đoán vị trí hay danh tính.',
      'severity chỉ phản ánh mức độ có thể quan sát trong ảnh; evidence phải nêu dấu hiệu nhìn thấy.',
    ].join(' '), trafficImageAnalysisSchema, unknownTrafficResult);
    return { result, model: this.model };
  }

  async recognizeSign(image: VisionImage): Promise<VisionResult> {
    const result = await this.generate(image, [
      'Nhận diện biển báo giao thông có thể nhìn thấy trong ảnh tại Việt Nam. Trả JSON đúng schema đã yêu cầu.',
      'Chép chữ chỉ khi đọc rõ; nếu không thì text=null, recognized=false hoặc category="unknown".',
      'Đây là gợi ý tham khảo từ ảnh, không kết luận quy tắc pháp lý hoặc tự tạo lệnh cấm đường.',
    ].join(' '), trafficSignRecognitionSchema, unknownSignResult);
    return { result, model: this.model };
  }

  private async generate<T extends Record<string, unknown>>(
    image: VisionImage,
    prompt: string,
    schema: { parse(value: unknown): T },
    fallback: T,
  ): Promise<T> {
    if (!env.GEMINI_API_KEY) throw new AppError(503, 'GEMINI_NOT_CONFIGURED', 'Dịch vụ phân tích ảnh chưa được cấu hình');
    try {
      const response = await new GoogleGenAI({ apiKey: env.GEMINI_API_KEY }).models.generateContent({
        model: this.model,
        contents: [
          { inlineData: { mimeType: image.mimeType, data: image.bytes.toString('base64') } },
          { text: prompt },
        ],
        config: { responseMimeType: 'application/json', temperature: 0.1 },
      });
      const text = response.text?.trim();
      if (!text) return fallback;
      const parsed: unknown = JSON.parse(text);
      const validated = schema.parse(parsed);
      return validated;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof SyntaxError || (typeof error === 'object' && error !== null && 'issues' in error)) return fallback;
      console.error('Gemini image analysis failed', { model: this.model });
      throw new AppError(502, 'GEMINI_UPSTREAM_ERROR', 'Nhà cung cấp AI chưa thể phân tích ảnh lúc này');
    }
  }
}
