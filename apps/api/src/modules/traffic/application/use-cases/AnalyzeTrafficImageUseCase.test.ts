import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../../shared/errors/AppError.js';
import { AnalyzeTrafficImageUseCase } from './AnalyzeTrafficImageUseCase.js';

const image = Buffer.from('img');
const analysis = { task: 'incident' } as never;

function setup(quotaError?: Error) {
  const analyzer = { analyze: vi.fn().mockResolvedValue(analysis) };
  const quota = {
    consume: vi.fn(async () => {
      if (quotaError) throw quotaError;
    }),
  };
  return { analyzer, quota };
}

describe('AnalyzeTrafficImageUseCase', () => {
  it('trừ hạn mức của người dùng trước khi gọi Gemini', async () => {
    const { analyzer, quota } = setup();
    const result = await new AnalyzeTrafficImageUseCase(analyzer, quota, true).execute(
      image,
      'image/jpeg',
      'incident',
      'token-1',
    );
    expect(result).toBe(analysis);
    expect(quota.consume).toHaveBeenCalledWith('token-1');
    expect(quota.consume.mock.invocationCallOrder[0]!).toBeLessThan(
      analyzer.analyze.mock.invocationCallOrder[0]!,
    );
  });

  it('không gọi Gemini khi đã hết hạn mức', async () => {
    const { analyzer, quota } = setup(new AppError(429, 'TRAFFIC_IMAGE_RATE_LIMIT', 'hết lượt'));
    await expect(
      new AnalyzeTrafficImageUseCase(analyzer, quota, true).execute(image, 'image/png', 'incident', 't'),
    ).rejects.toMatchObject({ statusCode: 429, code: 'TRAFFIC_IMAGE_RATE_LIMIT' });
    expect(analyzer.analyze).not.toHaveBeenCalled();
  });

  it('yêu cầu đăng nhập khi có hạn mức mà thiếu access token', async () => {
    const { analyzer, quota } = setup();
    await expect(
      new AnalyzeTrafficImageUseCase(analyzer, quota, true).execute(image, 'image/png', 'incident'),
    ).rejects.toMatchObject({ statusCode: 401, code: 'AUTH_REQUIRED' });
    expect(quota.consume).not.toHaveBeenCalled();
    expect(analyzer.analyze).not.toHaveBeenCalled();
  });

  it('không trừ hạn mức khi tính năng Gemini đang tắt', async () => {
    const { analyzer, quota } = setup();
    await new AnalyzeTrafficImageUseCase(analyzer, quota, false).execute(image, 'image/png', 'incident', 't');
    expect(quota.consume).not.toHaveBeenCalled();
    expect(analyzer.analyze).toHaveBeenCalledOnce();
  });
});
