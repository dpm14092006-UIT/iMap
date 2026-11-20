import { compareRoutesRequestSchema } from '@routetwin/shared';
import type { Request, RequestHandler, Response } from 'express';
import type { AuthenticatedRequest } from '../../../shared/http/authenticatedRequest.js';
import { requireAuth } from '../../../shared/http/requireAuth.js';
import { getBearerToken } from '../../../shared/http/requestContext.js';
import type {
  ComparisonMember,
  CompareRoutesUseCase,
} from '../application/use-cases/CompareRoutesUseCase.js';

/** HTTP cho so sánh tuyến: đọc body, xác thực khi cần AI, trả kết quả của use case. */
export class RouteComparisonController {
  constructor(
    private readonly compareRoutes: CompareRoutesUseCase,
    private readonly authenticate: RequestHandler = requireAuth(),
  ) {}

  compare: RequestHandler = async (req, res, next) => {
    try {
      const request = compareRoutesRequestSchema.parse(req.body);
      const authenticate =
        this.compareRoutes.canUseAi() && getBearerToken(req) ? () => this.member(req, res) : null;
      res.json({ data: await this.compareRoutes.execute(request, authenticate) });
    } catch (error) {
      next(error);
    }
  };

  /** Chạy middleware xác thực như một hàm; lỗi xác thực được use case coi là "không dùng AI". */
  private async member(req: Request, res: Response): Promise<ComparisonMember | null> {
    await new Promise<void>((resolve, reject) => {
      void this.authenticate(req, res, (error) => (error ? reject(error) : resolve()));
    });
    return (req as AuthenticatedRequest).auth ?? null;
  }
}
