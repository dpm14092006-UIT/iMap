import { describe, expect, it } from 'vitest';
import { sunPosition } from './sunPosition';

// Hà Nội 21.03°B 105.85°Đ, TP.HCM 10.78°B 106.70°Đ (giờ Việt Nam = UTC+7).
describe('sunPosition', () => {
  it('giữa trưa hạ chí ở Hà Nội: mặt trời gần thiên đỉnh, hơi lệch Bắc', () => {
    const sun = sunPosition(new Date('2026-06-21T05:00:00Z'), 21.03, 105.85);
    expect(sun.altitude).toBeGreaterThan(85);
  });

  it('giữa trưa đông chí ở Hà Nội: mặt trời ở phía Nam, cao khoảng 45°', () => {
    const sun = sunPosition(new Date('2026-12-21T05:00:00Z'), 21.03, 105.85);
    expect(sun.altitude).toBeGreaterThan(43);
    expect(sun.altitude).toBeLessThan(48);
    expect(sun.azimuth).toBeGreaterThan(165);
    expect(sun.azimuth).toBeLessThan(195);
  });

  it('buổi sáng mặt trời ở phía Đông, buổi chiều ở phía Tây', () => {
    const morning = sunPosition(new Date('2026-03-20T01:00:00Z'), 10.78, 106.7); // 8h sáng
    const afternoon = sunPosition(new Date('2026-03-20T09:00:00Z'), 10.78, 106.7); // 16h
    expect(morning.azimuth).toBeGreaterThan(60);
    expect(morning.azimuth).toBeLessThan(120);
    expect(afternoon.azimuth).toBeGreaterThan(240);
    expect(afternoon.azimuth).toBeLessThan(300);
    expect(morning.altitude).toBeGreaterThan(15);
  });

  it('nửa đêm mặt trời dưới chân trời', () => {
    expect(sunPosition(new Date('2026-03-20T17:00:00Z'), 10.78, 106.7).altitude).toBeLessThan(-40);
  });
});
