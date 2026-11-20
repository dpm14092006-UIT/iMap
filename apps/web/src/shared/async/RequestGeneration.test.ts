import { describe, expect, it } from 'vitest';
import { RequestGeneration } from './RequestGeneration';

describe('RequestGeneration', () => {
  it('chỉ yêu cầu mới nhất còn hiệu lực', () => {
    const generation = new RequestGeneration();
    const first = generation.begin();
    const second = generation.begin();
    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(true);
  });

  it('invalidate làm yêu cầu đang chờ hết hiệu lực', () => {
    const generation = new RequestGeneration();
    const pending = generation.begin();
    generation.invalidate();
    expect(pending.isCurrent()).toBe(false);
    expect(generation.begin().isCurrent()).toBe(true);
  });
});
