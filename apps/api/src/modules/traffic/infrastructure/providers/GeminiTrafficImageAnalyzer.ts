import {
  incidentTypes,
  trafficImageAnalysisTaskSchema,
  trafficSignImageAnalysisSchema,
  trafficIncidentImageAnalysisSchema,
  type TrafficImageAnalysisDto,
  type TrafficImageAnalysisTask,
} from '@routetwin/shared';
import { z } from 'zod';
import { AppError } from '../../../../shared/errors/AppError.js';
import type {
  TrafficImageAnalyzer,
  TrafficImageMimeType,
} from '../../application/ports/TrafficImageAnalyzer.js';

const apiIncidentResponseSchema = z
  .object({
    trafficRelated: z.boolean(),
    incidentType: z.enum([...incidentTypes, 'unknown']),
    severity: z.enum(['low', 'medium', 'high', 'unknown']),
    summary: z.string().trim().min(1).max(220),
    evidence: z.array(z.string().trim().min(1).max(120)).max(4),
    confidence: z.enum(['low', 'medium', 'high']),
  })
  .strict();

const apiSignResponseSchema = z
  .object({
    trafficSign: z.boolean(),
    category: z.enum(['prohibition', 'warning', 'mandatory', 'information', 'supplementary', 'unknown']),
    label: z.string().trim().min(1).max(120),
    visibleText: z.string().trim().max(120),
    confidence: z.enum(['low', 'medium', 'high']),
  })
  .strict();

const incidentJsonSchema = {
  type: 'object',
  properties: {
    trafficRelated: { type: 'boolean' },
    incidentType: { type: 'string', enum: [...incidentTypes, 'unknown'] },
    severity: { type: 'string', enum: ['low', 'medium', 'high', 'unknown'] },
    summary: { type: 'string' },
    evidence: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['trafficRelated', 'incidentType', 'severity', 'summary', 'evidence', 'confidence'],
  additionalProperties: false,
};

const signJsonSchema = {
  type: 'object',
  properties: {
    trafficSign: { type: 'boolean' },
    category: {
      type: 'string',
      enum: ['prohibition', 'warning', 'mandatory', 'information', 'supplementary', 'unknown'],
    },
    label: { type: 'string' },
    visibleText: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['trafficSign', 'category', 'label', 'visibleText', 'confidence'],
  additionalProperties: false,
};

const prompts: Record<TrafficImageAnalysisTask, string> = {
  incident: [
    'Bạn hỗ trợ người dùng lập báo cáo giao thông cộng đồng tại Việt Nam từ một ảnh hiện trường.',
    'Chỉ mô tả điều nhìn thấy trực tiếp; không suy đoán tốc độ, nguyên nhân, vị trí, danh tính, thương tích hay tình hình hiện tại từ ảnh tĩnh.',
    'Nếu ảnh không rõ hoặc không cho biết đây là sự cố giao thông, hãy đặt trafficRelated=false, incidentType="unknown", severity="unknown", confidence="low" và nêu ngắn gọn sự không chắc chắn.',
    'Chọn incidentType trong traffic_jam, accident, construction, flood, road_closure, obstacle, unknown. severity là gợi ý sơ bộ, không phải kết luận.',
    'Viết summary ngắn bằng tiếng Việt để người dùng có thể sửa trước khi gửi. evidence tối đa 4 chi tiết nhìn thấy. Không nhận diện khuôn mặt hoặc biển số xe.',
  ].join(' '),
  traffic_sign: [
    'Bạn nhận diện biển báo giao thông Việt Nam từ một ảnh.',
    'Chỉ đọc nội dung nhìn thấy. Không khẳng định hiệu lực pháp lý nếu không có ngữ cảnh về chiều đường, vị trí, biển phụ, thời điểm và tình trạng biển.',
    'Nếu ảnh không có biển báo rõ ràng, đặt trafficSign=false, category="unknown", confidence="low" và mô tả rằng chưa nhận diện được.',
    'category chọn prohibition, warning, mandatory, information, supplementary, unknown. label ngắn gọn bằng tiếng Việt; visibleText chỉ ghi chữ/số nhìn thấy, để rỗng nếu không đọc được.',
    'Không suy đoán tốc độ hay tự thay đổi tuyến đường. Không nhận diện người hoặc biển số xe.',
  ].join(' '),
};

type GeminiTextContent = { type?: unknown; text?: unknown };
type GeminiInteraction = {
  output_text?: unknown;
  steps?: Array<{ type?: unknown; content?: GeminiTextContent[] }>;
  outputs?: GeminiTextContent[];
};

function extractInteractionText(interaction: GeminiInteraction): string | undefined {
  if (typeof interaction.output_text === 'string') return interaction.output_text;

  const modelOutput = interaction.steps
    ?.slice()
    .reverse()
    .find((step) => step.type === 'model_output');
  const stepText = modelOutput?.content
    ?.filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('');
  if (stepText) return stepText;

  const legacyText = interaction.outputs
    ?.filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('');
  return legacyText || undefined;
}

export class GeminiTrafficImageAnalyzer implements TrafficImageAnalyzer {
  private readonly endpoint = 'https://generativelanguage.googleapis.com/v1beta/interactions';

  constructor(
    private readonly apiKey: string | undefined,
    private readonly model = 'gemini-3.8-flash',
    private readonly enabled = false,
  ) {}

  async analyze(
    image: Buffer,
    mimeType: TrafficImageMimeType,
    task: TrafficImageAnalysisTask,
  ): Promise<TrafficImageAnalysisDto> {
    if (!this.enabled)
      throw new AppError(503, 'GEMINI_NOT_ENABLED', 'AI ảnh chưa được bật cho ứng dụng này.');
    if (!this.apiKey)
      throw new AppError(503, 'GEMINI_NOT_CONFIGURED', 'Chức năng AI ảnh chưa được cấu hình.');
    const validatedTask = trafficImageAnalysisTaskSchema.parse(task);
    const schema = validatedTask === 'incident' ? incidentJsonSchema : signJsonSchema;
    const payload = {
      model: this.model,
      input: [
        { type: 'text', text: prompts[validatedTask] },
        { type: 'image', data: image.toString('base64'), mime_type: mimeType },
      ],
      response_format: { type: 'text', mime_type: 'application/json', schema },
      store: false,
    };

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify(payload),
        // Keep the deadline active while the response body is being read below.
        signal: AbortSignal.timeout(25_000),
      });
    } catch (error) {
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
        throw new AppError(504, 'GEMINI_TIMEOUT', 'AI xử lý ảnh quá thời gian chờ. Vui lòng thử lại.');
      }
      throw new AppError(502, 'GEMINI_UNAVAILABLE', 'Không kết nối được dịch vụ AI ảnh.');
    }

    if (!response.ok) {
      if (response.status === 429)
        throw new AppError(
          429,
          'GEMINI_RATE_LIMITED',
          'AI đang quá tải hoặc hết lượt sử dụng. Vui lòng thử lại sau.',
        );
      if (response.status === 401 || response.status === 403)
        throw new AppError(
          503,
          'GEMINI_CONFIGURATION_ERROR',
          'Khóa Gemini không hợp lệ hoặc chưa được cấp quyền.',
        );
      throw new AppError(502, 'GEMINI_PROVIDER_ERROR', 'Dịch vụ AI chưa thể phân tích ảnh lúc này.');
    }

    let interaction: GeminiInteraction;
    try {
      interaction = (await response.json()) as GeminiInteraction;
    } catch (error) {
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
        throw new AppError(504, 'GEMINI_TIMEOUT', 'AI xử lý ảnh quá thời gian chờ. Vui lòng thử lại.');
      }
      throw new AppError(502, 'GEMINI_INVALID_RESPONSE', 'AI trả về dữ liệu không hợp lệ.');
    }
    const outputText = extractInteractionText(interaction);
    if (!outputText) {
      throw new AppError(502, 'GEMINI_INVALID_RESPONSE', 'AI không trả về kết quả phân tích.');
    }

    let modelResult: unknown;
    if (outputText) {
      try {
        modelResult = JSON.parse(outputText);
      } catch {
        throw new AppError(502, 'GEMINI_INVALID_RESPONSE', 'AI trả về kết quả không đọc được.');
      }
    } else if (!Array.isArray(interaction.steps) && !Array.isArray(interaction.outputs)) {
      // Some structured-output REST responses return the JSON object as the response body.
      modelResult = interaction;
    } else {
      throw new AppError(502, 'GEMINI_INVALID_RESPONSE', 'AI không trả về kết quả phân tích.');
    }

    if (validatedTask === 'incident') {
      const result = apiIncidentResponseSchema.safeParse(modelResult);
      if (!result.success)
        throw new AppError(502, 'GEMINI_INVALID_RESPONSE', 'Kết quả phân tích sự cố chưa đúng định dạng.');
      return trafficIncidentImageAnalysisSchema.parse({
        task: 'incident',
        ...result.data,
        canDetermineSpeed: false,
      });
    }
    const result = apiSignResponseSchema.safeParse(modelResult);
    if (!result.success)
      throw new AppError(502, 'GEMINI_INVALID_RESPONSE', 'Kết quả nhận diện biển báo chưa đúng định dạng.');
    return trafficSignImageAnalysisSchema.parse({
      task: 'traffic_sign',
      ...result.data,
      changesRouteRules: false,
    });
  }
}
