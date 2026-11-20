import { describe, expect, it } from 'vitest';
import { RequestSequence } from './RequestSequence';

describe('RequestSequence (review #10)', () => {
  it('chọn điểm hai lần liên tiếp: chỉ lần sau được ghi, dù lần đầu về chậm hơn', () => {
    const sequence = new RequestSequence<'origin' | 'destination'>();
    const first = sequence.next('origin');
    const second = sequence.next('origin');
    expect(sequence.isLatest('origin', second)).toBe(true);
    expect(sequence.isLatest('origin', first)).toBe(false);
  });

  it('các kênh độc lập: chọn điểm đến không làm hỏng yêu cầu điểm đi', () => {
    const sequence = new RequestSequence<'origin' | 'destination'>();
    const origin = sequence.next('origin');
    sequence.next('destination');
    expect(sequence.isLatest('origin', origin)).toBe(true);
  });
});
