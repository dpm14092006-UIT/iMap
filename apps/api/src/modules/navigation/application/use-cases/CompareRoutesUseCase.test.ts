import type { CompareRoutesRequest, RouteComparisonFact } from '@routetwin/shared';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../../shared/errors/AppError.js';
import type { FeatureQuota } from '../../../../shared/quota/FeatureQuota.js';
import type { RouteComparisonSnapshots } from '../ports/RouteComparisonSnapshots.js';
import type { RoutePreferenceProvider } from '../ports/RoutePreferenceProvider.js';
import { CompareRoutesUseCase } from './CompareRoutesUseCase.js';

const routes: [RouteComparisonFact, ...RouteComparisonFact[]] = [
  { id: 'A', durationSeconds: 1_440, distanceMeters: 8_200, turnCount: 12 },
  { id: 'B', durationSeconds: 1_620, distanceMeters: 9_100, turnCount: 6 },
];
const snapshots: RouteComparisonSnapshots = { sign: () => undefined, verify: () => routes };
const member = { userId: 'member', accessToken: 'token' };
const textRequest = (text: string): CompareRoutesRequest => ({
  snapshot: 'signed',
  sessionId: '00000000-0000-4000-8000-000000000000',
  preference: { kind: 'text', text },
});

function setup(provider?: RoutePreferenceProvider) {
  const quota: FeatureQuota = { consume: vi.fn().mockResolvedValue(undefined) };
  return { quota, useCase: new CompareRoutesUseCase(snapshots, provider, quota) };
}

describe('CompareRoutesUseCase', () => {
  it('rejects an invalid snapshot before authentication, quota or AI are touched', async () => {
    const authenticate = vi.fn();
    const interpret = vi.fn();
    const consume = vi.fn();
    const expired = new AppError(410, 'SNAPSHOT_EXPIRED', 'expired');
    const useCase = new CompareRoutesUseCase(
      {
        ...snapshots,
        verify: () => {
          throw expired;
        },
      },
      { interpret },
      { consume },
    );
    await expect(useCase.execute(textRequest('fewest turns'), authenticate)).rejects.toBe(expired);
    expect(authenticate).not.toHaveBeenCalled();
    expect(consume).not.toHaveBeenCalled();
    expect(interpret).not.toHaveBeenCalled();
  });

  it('never calls the paid provider after quota consumption fails', async () => {
    const interpret = vi.fn();
    const useCase = new CompareRoutesUseCase(
      snapshots,
      { interpret },
      {
        consume: vi.fn().mockRejectedValue(new Error('quota exhausted')),
      },
    );
    expect((await useCase.execute(textRequest('fewest turns'), async () => member)).source).toBe('rules');
    expect(interpret).not.toHaveBeenCalled();
  });

  it('bounds concurrent AI calls and releases a failed slot for the next request', async () => {
    let reject!: (error: Error) => void;
    let resolve!: (value: { goal: 'fastest'; maxExtraMinutes: null }) => void;
    const first = new Promise<never>((_yes, no) => {
      reject = no;
    });
    const second = new Promise<{ goal: 'fastest'; maxExtraMinutes: null }>((yes) => {
      resolve = yes;
    });
    const interpret = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
      .mockResolvedValue({ goal: 'fastest', maxExtraMinutes: null });
    const { useCase, quota } = setup({ interpret });
    const requestA = useCase.execute(textRequest('request-a'), async () => member);
    const requestB = useCase.execute(textRequest('request-b'), async () => member);
    const overflow = await useCase.execute(textRequest('overflow'), async () => member);
    expect(overflow.source).toBe('rules');
    expect(interpret).toHaveBeenCalledTimes(2);
    expect(quota.consume).toHaveBeenCalledTimes(2);
    reject(new Error('provider failed'));
    expect((await requestA).source).toBe('rules');
    expect((await useCase.execute(textRequest('after-failure'), async () => member)).source).toBe('ai');
    resolve({ goal: 'fastest', maxExtraMinutes: null });
    await requestB;
    expect(interpret).toHaveBeenCalledTimes(3);
  });

  it('isolates cached decisions by both member and signed snapshot', async () => {
    const interpret = vi.fn().mockResolvedValue({ goal: 'fastest', maxExtraMinutes: null });
    const { useCase, quota } = setup({ interpret });
    const request = textRequest('same text');
    await useCase.execute(request, async () => member);
    await useCase.execute(request, async () => ({ ...member, userId: 'other-member' }));
    await useCase.execute({ ...request, snapshot: 'another-snapshot' }, async () => member);
    expect(interpret).toHaveBeenCalledTimes(3);
    expect(quota.consume).toHaveBeenCalledTimes(3);
  });
  it('báo 503 khi chưa cấu hình khóa ký ảnh chụp', async () => {
    const useCase = new CompareRoutesUseCase(undefined, undefined, { consume: vi.fn() });
    await expect(useCase.execute(textRequest('nhanh'), null)).rejects.toBeInstanceOf(AppError);
  });

  it('mong muốn chọn sẵn chỉ dùng bộ quy tắc, không xác thực', async () => {
    const { useCase } = setup({ interpret: vi.fn() });
    const authenticate = vi.fn();
    const result = await useCase.execute(
      { ...textRequest('x'), preference: { kind: 'preset', goal: 'fewest-turns' } },
      authenticate,
    );
    expect(result).toMatchObject({ source: 'rules', recommendedId: 'B' });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('không có người gọi xác thực được thì dùng quy tắc và không trừ hạn mức', async () => {
    const interpret = vi.fn();
    const { useCase, quota } = setup({ interpret });
    const result = await useCase.execute(textRequest('Ít rẽ hơn, đi thêm tối đa 5 phút'), async () => null);
    expect(result.source).toBe('rules');
    expect(quota.consume).not.toHaveBeenCalled();
    expect(interpret).not.toHaveBeenCalled();
  });

  it('dùng AI một lần cho cùng câu hỏi rồi lấy từ bộ nhớ', async () => {
    const interpret = vi.fn().mockResolvedValue({ goal: 'fewest-turns', maxExtraMinutes: 5 });
    const { useCase, quota } = setup({ interpret });
    const request = textRequest('Ít rẽ hơn');
    expect(await useCase.execute(request, async () => member)).toMatchObject({
      source: 'ai',
      recommendedId: 'B',
    });
    expect(await useCase.execute(request, async () => member)).toMatchObject({ source: 'ai' });
    expect(interpret).toHaveBeenCalledTimes(1);
    expect(quota.consume).toHaveBeenCalledExactlyOnceWith('route_explanation', 'token');
  });

  it('AI hoặc xác thực lỗi thì quay về quy tắc', async () => {
    const { useCase } = setup({ interpret: vi.fn().mockRejectedValue(new Error('provider down')) });
    expect((await useCase.execute(textRequest('nhanh nhất'), async () => member)).source).toBe('rules');
    const failingAuth = async () => {
      throw new AppError(401, 'INVALID_SESSION', 'expired');
    };
    expect((await useCase.execute(textRequest('nhanh nhất'), failingAuth)).source).toBe('rules');
  });
});
