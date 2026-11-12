import express from 'express';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createRateLimitMiddleware, RateLimiter } from './RateLimiter.js';

describe('RateLimiter', () => {
  it('cho phép N lượt, chặn lượt N+1 và đếm ngược remaining', () => {
    const limiter = new RateLimiter({ limit: 3, windowMs: 60_000, now: () => 0 });
    expect([1, 2, 3].map(() => limiter.hit('a'))).toMatchObject([
      { allowed: true, remaining: 2 },
      { allowed: true, remaining: 1 },
      { allowed: true, remaining: 0 },
    ]);
    expect(limiter.hit('a')).toMatchObject({ allowed: false, remaining: 0, limit: 3, resetSeconds: 60 });
  });

  it('đặt lại sau khi hết cửa sổ', () => {
    let now = 0;
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000, now: () => now });
    expect(limiter.hit('a').allowed).toBe(true);
    now = 400;
    expect(limiter.hit('a')).toMatchObject({ allowed: false, resetSeconds: 1 });
    now = 1000;
    expect(limiter.hit('a').allowed).toBe(true);
  });

  it('tách bộ đếm theo khóa', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });
    expect(limiter.hit('a').allowed).toBe(true);
    expect(limiter.hit('a').allowed).toBe(false);
    expect(limiter.hit('b').allowed).toBe(true);
  });

  it('dọn bucket hết hạn và giữ trần số khóa', () => {
    let now = 0;
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000, maxKeys: 5, now: () => now });
    for (let i = 0; i < 4; i++) limiter.hit(`ip${i}`);
    expect(limiter.size).toBe(4);
    now = 2000;
    limiter.hit('fresh');
    expect(limiter.size).toBe(1);
    for (let i = 0; i < 20; i++) limiter.hit(`flood${i}`);
    expect(limiter.size).toBe(5);
  });
});

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))));
});

describe('createRateLimitMiddleware', () => {
  it('trả 429 RATE_LIMITED kèm header chuẩn khi vượt giới hạn', async () => {
    const app = express();
    let handled = 0;
    app.get('/x', createRateLimitMiddleware(new RateLimiter({ limit: 2, windowMs: 60_000 })), (_req, res) => {
      handled += 1;
      res.json({ ok: true });
    });
    const server = app.listen(0);
    servers.push(server);
    await once(server, 'listening');
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/x`;

    const first = await fetch(url);
    expect(first.status).toBe(200);
    expect(first.headers.get('ratelimit-limit')).toBe('2');
    expect(first.headers.get('ratelimit-remaining')).toBe('1');
    await fetch(url);
    const blocked = await fetch(url);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('ratelimit-remaining')).toBe('0');
    expect(Number(blocked.headers.get('ratelimit-reset'))).toBeGreaterThan(0);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await blocked.json()).error).toMatchObject({ code: 'RATE_LIMITED' });
    expect(handled).toBe(2);
  });
});
