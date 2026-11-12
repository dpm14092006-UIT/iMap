import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { getRequestId } from './request-context.js';

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Số giây (làm tròn lên) tới khi cửa sổ hiện tại kết thúc. */
  resetSeconds: number;
};

export type RateLimiterOptions = {
  /** Số lượt tối đa mỗi khóa trong một cửa sổ. */
  limit: number;
  windowMs: number;
  /** Trần số khóa lưu trong RAM; vượt trần thì bỏ các khóa cũ nhất. */
  maxKeys?: number;
  now?: () => number;
};

type Bucket = { count: number; resetAt: number };

/**
 * Giới hạn tốc độ cửa sổ cố định trong RAM, không phụ thuộc thư viện.
 * Chỉ bảo vệ trong một process/instance (không chia sẻ giữa nhiều instance serverless).
 * Bucket hết hạn được dọn lười mỗi khi qua một cửa sổ, nên bộ nhớ không tăng vô hạn.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;
  private readonly now: () => number;
  private nextSweepAt = 0;

  constructor(options: RateLimiterOptions) {
    this.limit = Math.max(1, Math.floor(options.limit));
    this.windowMs = Math.max(1, Math.floor(options.windowMs));
    this.maxKeys = options.maxKeys ?? 10_000;
    this.now = options.now ?? Date.now;
  }

  /** Ghi nhận một lượt cho `key` và cho biết có được phép không (lượt bị chặn không tăng bộ đếm). */
  hit(key: string): RateLimitDecision {
    const now = this.now();
    this.sweep(now);
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
      this.enforceKeyCap();
    }
    const allowed = bucket.count < this.limit;
    if (allowed) bucket.count += 1;
    return {
      allowed,
      limit: this.limit,
      remaining: Math.max(0, this.limit - bucket.count),
      resetSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  /** Số khóa đang giữ (dùng cho kiểm thử). */
  get size(): number {
    return this.buckets.size;
  }

  private sweep(now: number): void {
    if (now < this.nextSweepAt) return;
    this.nextSweepAt = now + this.windowMs;
    for (const [key, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(key);
  }

  private enforceKeyCap(): void {
    // Map giữ thứ tự thêm vào, nên khóa đầu tiên là khóa cũ nhất.
    while (this.buckets.size > this.maxKeys) {
      const oldest = this.buckets.keys().next();
      if (oldest.done) return;
      this.buckets.delete(oldest.value);
    }
  }
}

/** Middleware giới hạn theo IP máy khách (`req.ip`, tôn trọng cài đặt `trust proxy` của Express). */
export function createRateLimitMiddleware(limiter: RateLimiter): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const decision = limiter.hit(req.ip ?? req.socket.remoteAddress ?? 'unknown');
    res.setHeader('RateLimit-Limit', String(decision.limit));
    res.setHeader('RateLimit-Remaining', String(decision.remaining));
    res.setHeader('RateLimit-Reset', String(decision.resetSeconds));
    if (decision.allowed) {
      next();
      return;
    }
    res.setHeader('Retry-After', String(decision.resetSeconds));
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.',
        requestId: getRequestId(req),
      },
    });
  };
}

/** Tạo middleware giới hạn `perMinute` lượt/phút/IP. */
export function perMinuteRateLimit(perMinute: number): RequestHandler {
  return createRateLimitMiddleware(new RateLimiter({ limit: perMinute, windowMs: 60_000 }));
}
