import { describe, expect, it } from 'vitest';
import { computeAreaInsight, isRushHour, type AreaInsight } from './areaInsight';

function estimated(insight: AreaInsight) {
  if (insight.status !== 'estimated') throw new Error('expected an estimate');
  return insight;
}

const at = (hour: number, minute = 0) => new Date(2026, 0, 10, hour, minute);

describe('computeAreaInsight', () => {
  it('gắn nhãn giao thông là ước tính', () => {
    expect(estimated(computeAreaInsight(0, at(11))).trafficLabel).toBe('Ước tính: Giao thông thông thoáng');
    expect(estimated(computeAreaInsight(6, at(11))).trafficLabel).toMatch(/^Ước tính: /);
  });

  it('ngoài giờ cao điểm và không có sự cố thì thông thoáng', () => {
    const insight = estimated(computeAreaInsight(0, at(11)));
    expect(insight.trafficLevel).toBe('smooth');
    expect(insight.delayMinutes).toBe(0);
  });

  it('giờ cao điểm hoặc có sự cố thì vừa phải và chậm hơn thường lệ', () => {
    const rush = estimated(computeAreaInsight(0, at(8)));
    expect(rush.trafficLevel).toBe('moderate');
    expect(rush.delayMinutes).toBeGreaterThan(0);
    expect(estimated(computeAreaInsight(1, at(11))).trafficLevel).toBe('moderate');
  });

  it('nhiều sự cố hoặc cao điểm kèm sự cố thì đông đúc', () => {
    expect(estimated(computeAreaInsight(6, at(11))).trafficLevel).toBe('heavy');
    expect(estimated(computeAreaInsight(3, at(17, 45))).trafficLevel).toBe('heavy');
  });

  it('chậm hơn khi có thêm sự cố và đếm lại số sự cố', () => {
    const few = estimated(computeAreaInsight(1, at(11)));
    const many = estimated(computeAreaInsight(2, at(11)));
    expect(many.delayMinutes).toBeGreaterThan(few.delayMinutes);
    expect(many.incidentCount).toBe(2);
  });

  it('giờ cao điểm đúng các mốc 7–9h và 16:30–19h', () => {
    expect(isRushHour(at(6, 59))).toBe(false);
    expect(isRushHour(at(7))).toBe(true);
    expect(isRushHour(at(9))).toBe(false);
    expect(isRushHour(at(16, 29))).toBe(false);
    expect(isRushHour(at(16, 30))).toBe(true);
    expect(isRushHour(at(19))).toBe(false);
  });

  it('không còn thời tiết minh họa (trước đây là số giả trông như thật)', () => {
    const insight = computeAreaInsight(0, at(14));
    expect(insight).not.toHaveProperty('temperatureC');
    expect(insight).not.toHaveProperty('weather');
  });

  it('bản đồ thu nhỏ quá thì không đoán "thông thoáng" mà yêu cầu phóng to', () => {
    expect(computeAreaInsight(0, at(11), false)).toEqual({ status: 'zoom-in' });
    expect(computeAreaInsight(5, at(8), false)).toEqual({ status: 'zoom-in' });
    expect(computeAreaInsight(0, at(11), true).status).toBe('estimated');
  });

  it('cùng đầu vào cho cùng kết quả', () => {
    for (let hour = 0; hour < 24; hour++)
      expect(computeAreaInsight(2, at(hour))).toEqual(computeAreaInsight(2, at(hour)));
  });
});
