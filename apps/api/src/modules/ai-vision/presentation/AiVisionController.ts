import type { Request, Response } from 'express';
import { AppError } from '../../../shared/errors/AppError.js';
import type { AuthenticatedRequest } from '../../../shared/http/authenticated-request.js';
import type { AnalyzeTrafficImageUseCase } from '../application/use-cases/AnalyzeTrafficImageUseCase.js';
import type { RecognizeTrafficSignUseCase } from '../application/use-cases/RecognizeTrafficSignUseCase.js';
import type { ListAiAnalysesUseCase } from '../application/use-cases/ListAiAnalysesUseCase.js';
import type { SupportedImageMime, VisionImage } from '../application/ports/AiVisionProvider.js';
import type { RequestHandler } from 'express';

const imageMimes = new Set<SupportedImageMime>(['image/jpeg', 'image/png', 'image/webp']);

function parseImage(request: Request): VisionImage {
  const mimeType = request.header('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (!mimeType || !imageMimes.has(mimeType as SupportedImageMime)) {
    throw new AppError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP');
  }
  if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
    throw new AppError(400, 'IMAGE_REQUIRED', 'Vui lòng gửi nội dung ảnh');
  }
  if (request.body.length > 5 * 1024 * 1024) {
    throw new AppError(413, 'IMAGE_TOO_LARGE', 'Ảnh tối đa 5 MB');
  }
  const bytes = request.body as Buffer;
  const signatureMatches = mimeType === 'image/jpeg'
    ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : mimeType === 'image/png'
      ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!signatureMatches) throw new AppError(415, 'INVALID_IMAGE', 'Nội dung ảnh không khớp định dạng được khai báo');
  return { bytes, mimeType: mimeType as SupportedImageMime };
}

type VisionRequest = AuthenticatedRequest & { visionImage?: VisionImage };

export const validateVisionImage: RequestHandler = (request, _response, next) => {
  try {
    (request as VisionRequest).visionImage = parseImage(request);
    next();
  } catch (error) {
    next(error);
  }
};

export class AiVisionController {
  constructor(
    private readonly analyzeTraffic: AnalyzeTrafficImageUseCase,
    private readonly recognizeSign: RecognizeTrafficSignUseCase,
    private readonly listAnalyses: ListAiAnalysesUseCase,
  ) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const auth = (request as AuthenticatedRequest).auth;
    if (!auth) throw new AppError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để xem lịch sử phân tích');
    response.json({ data: await this.listAnalyses.execute(auth.accessToken) });
  };

  analyze = async (request: Request, response: Response): Promise<void> => {
    const auth = (request as AuthenticatedRequest).auth;
    if (!auth) throw new AppError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để phân tích ảnh');
    const image = (request as VisionRequest).visionImage;
    if (!image) throw new AppError(400, 'IMAGE_REQUIRED', 'Vui lòng gửi nội dung ảnh');
    const result = await this.analyzeTraffic.execute(image, auth.userId, auth.accessToken);
    response.json({ data: result });
  };

  recognize = async (request: Request, response: Response): Promise<void> => {
    const auth = (request as AuthenticatedRequest).auth;
    if (!auth) throw new AppError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để nhận diện biển báo');
    const image = (request as VisionRequest).visionImage;
    if (!image) throw new AppError(400, 'IMAGE_REQUIRED', 'Vui lòng gửi nội dung ảnh');
    const result = await this.recognizeSign.execute(image, auth.userId, auth.accessToken);
    response.json({ data: result });
  };
}
