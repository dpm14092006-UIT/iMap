import { describe, expect, it } from 'vitest';
import { computeAreaInsight, isRushHour } from './areaInsight';

const at = (hour: number, minute = 0) => new Date(2026, 0, 10, hour, minute);

describe('computeAreaInsight', () => {
  it('gắn nhãn giao thông là ước tính', () => {
    expect(computeAreaInsight(0, at(11)).trafficLabel).toBe('Ước tính: Giao thông thông thoáng');
    expect(computeAreaInsight(6, at(11)).trafficLabel).toMatch(/^Ước tính: /);
  });

  it('ngoài giờ cao điểm và không có sự cố thì thông thoáng', () => {
    const insight = computeAreaInsight(0, at(11));
    expect(insight.trafficLevel).toBe('smooth');
    expect(insight.delayMinutes).toBe(0);
  });

  it('giờ cao điểm hoặc có sự cố thì vừa phải và chậm hơn thường lệ', () => {
    const rush = computeAreaInsight(0, at(8));
    expect(rush.trafficLevel).toBe('moderate');
    expect(rush.delayMinutes).toBeGreaterThan(0);
    expect(computeAreaInsight(1, at(11)).trafficLevel).toBe('moderate');
  });

  it('nhiều sự cố hoặc cao điểm kèm sự cố thì đông đúc', () => {
    expect(computeAreaInsight(6, at(11)).trafficLevel).toBe('heavy');
    expect(computeAreaInsight(3, at(17, 45)).trafficLevel).toBe('heavy');
  });

  it('chậm hơn khi có thêm sự cố và đếm lại số sự cố', () => {
    const few = computeAreaInsight(1, at(11));
    const many = computeAreaInsight(2, at(11));
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

  it('nhiệt độ luôn trong 26–33°C và cùng giờ cho cùng kết quả', () => {
    for (let hour = 0; hour < 24; hour++) {
      const { temperatureC } = computeAreaInsight(0, at(hour));
      expect(temperatureC).toBeGreaterThanOrEqual(26);
      expect(temperatureC).toBeLessThanOrEqual(33);
      expect(computeAreaInsight(2, at(hour))).toEqual(computeAreaInsight(2, at(hour)));
    }
    expect(computeAreaInsight(0, at(14)).temperatureC).toBe(33);
  });

  it('thời tiết đổi theo giờ', () => {
    expect(computeAreaInsight(0, at(9)).weather).toBe('sunny');
    expect(computeAreaInsight(0, at(16)).weather).toBe('rain');
    expect(computeAreaInsight(0, at(22)).weather).toBe('night');
  });
});
