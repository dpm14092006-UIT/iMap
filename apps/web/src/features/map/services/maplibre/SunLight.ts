import { sunPosition } from '../../../../shared/geo/sunPosition';
import type { GLMap } from './gl';

/**
 * Ánh sáng mô phỏng theo vị trí mặt trời (4D): hướng/độ cao nguồn sáng của khối 3D và màu trời đổi theo giờ.
 * MapLibre không vẽ bóng đổ thật; chỉ đổi hướng chiếu sáng. Không sửa lớp nào của nhà cung cấp.
 */
export class SunLight {
  private time: number | null = null;

  constructor(private readonly map: GLMap) {}

  /** `time` = mốc thời gian (ms) cần mô phỏng; null = ánh sáng mặc định của style. */
  set(time: number | null | undefined) {
    time ??= null;
    if (time === this.time) return;
    this.time = time;
    this.apply();
  }

  /** Gọi lại sau khi style mới nạp (setStyle xóa light/sky) và khi camera đi xa. */
  apply() {
    // Style chưa nạp xong thì setLight/setSky ném lỗi; giá trị đã lưu, 'style.load' sẽ gọi lại hàm này.
    try {
      this.applyNow();
    } catch (error) {
      if (!(error instanceof Error) || !/not done loading/i.test(error.message)) throw error;
    }
  }

  private applyNow() {
    if (this.time === null) {
      this.map.setLight({ anchor: 'viewport', position: [1.15, 210, 30], color: '#ffffff', intensity: 0.5 });
      this.map.setSky(undefined as never);
      return;
    }
    const center = this.map.getCenter();
    const sun = sunPosition(new Date(this.time), center.lat, center.lng);
    const day = Math.max(0, Math.min(1, (sun.altitude + 6) / 18)); // 0 = đêm, 1 = ngày (qua hoàng hôn dân dụng)
    const low = sun.altitude > -6 && sun.altitude < 12; // bình minh / hoàng hôn
    this.map.setLight({
      anchor: 'map',
      // Độ cao cực: 0° = đỉnh đầu, 90° = chân trời; mặt trời dưới chân trời thì giữ sát chân trời.
      position: [1.15, sun.azimuth, Math.min(89, Math.max(0, 90 - sun.altitude))],
      color: low ? '#ffc9a0' : day > 0 ? '#ffffff' : '#9fb4ff',
      intensity: 0.15 + 0.45 * day,
    });
    this.map.setSky({
      'sky-color': mix('#0b1633', '#79b8ec', day),
      'horizon-color': low ? '#f6b98a' : mix('#1c2b52', '#d8ecfb', day),
      'fog-color': mix('#0f1a33', '#ffffff', day),
      'sky-horizon-blend': 0.5,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.9,
      'atmosphere-blend': 0.6,
    });
  }

  /** Thời gian đang mô phỏng (kiểm thử). */
  current(): number | null {
    return this.time;
  }
}

function mix(a: string, b: string, t: number): string {
  const channel = (hex: string, offset: number) => parseInt(hex.slice(offset, offset + 2), 16);
  const out = [1, 3, 5].map((offset) =>
    Math.round(channel(a, offset) + (channel(b, offset) - channel(a, offset)) * t)
      .toString(16)
      .padStart(2, '0'),
  );
  return `#${out.join('')}`;
}
