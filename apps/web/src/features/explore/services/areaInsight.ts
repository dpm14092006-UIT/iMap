import type { IconName } from '../../../shared/components/Icon';

export type TrafficLevel = 'smooth' | 'moderate' | 'heavy';
export type WeatherKind = 'sunny' | 'cloudy' | 'rain' | 'night';

export type AreaInsight = {
  temperatureC: number;
  weather: WeatherKind;
  weatherLabel: string;
  weatherIcon: IconName;
  trafficLevel: TrafficLevel;
  trafficLabel: string;
  /** Ước tính chậm hơn thường lệ bao nhiêu phút (0 nếu thông thoáng). */
  delayMinutes: number;
  incidentCount: number;
};

const weatherByKind: Record<WeatherKind, { label: string; icon: IconName }> = {
  sunny: { label: 'Nắng', icon: 'sun' },
  cloudy: { label: 'Nhiều mây', icon: 'cloud' },
  rain: { label: 'Mưa rào', icon: 'rain' },
  night: { label: 'Trời quang', icon: 'moon' },
};

const trafficLabels: Record<TrafficLevel, string> = {
  smooth: 'Giao thông thông thoáng',
  moderate: 'Giao thông vừa phải',
  heavy: 'Giao thông đông đúc',
};

/** Giờ cao điểm: 7–9h và 16:30–19h. */
export function isRushHour(now: Date): boolean {
  const hour = now.getHours() + now.getMinutes() / 60;
  return (hour >= 7 && hour < 9) || (hour >= 16.5 && hour < 19);
}

/** Thời tiết minh họa theo giờ trong ngày, nhiệt độ 26–33°C (nóng nhất khoảng 14h). */
export function sampleWeather(now: Date): Pick<AreaInsight, 'temperatureC' | 'weather'> {
  const hour = now.getHours() + now.getMinutes() / 60;
  const temperatureC = Math.round(29.5 + 3.5 * Math.cos(((hour - 14) / 24) * 2 * Math.PI));
  const weather: WeatherKind =
    hour >= 19 || hour < 6
      ? 'night'
      : hour < 11
        ? 'sunny'
        : hour < 15
          ? 'cloudy'
          : hour < 17
            ? 'rain'
            : 'cloudy';
  return { temperatureC, weather };
}

/**
 * Tổng hợp "Khu vực này" từ số sự cố đang báo trong khung nhìn và giờ trong ngày.
 * Thời tiết là dữ liệu minh họa; giao thông suy ra từ sự cố thật + giờ cao điểm.
 */
export function computeAreaInsight(incidentCount: number, now = new Date()): AreaInsight {
  const rush = isRushHour(now);
  const score =
    (rush ? 1 : 0) + (incidentCount >= 6 ? 3 : incidentCount >= 3 ? 2 : incidentCount >= 1 ? 1 : 0);
  const trafficLevel: TrafficLevel = score >= 3 ? 'heavy' : score >= 1 ? 'moderate' : 'smooth';
  const delayMinutes =
    trafficLevel === 'smooth'
      ? 0
      : Math.min(60, (rush ? 6 : 3) + incidentCount * 2 + (trafficLevel === 'heavy' ? 8 : 0));
  const { temperatureC, weather } = sampleWeather(now);
  return {
    temperatureC,
    weather,
    weatherLabel: weatherByKind[weather].label,
    weatherIcon: weatherByKind[weather].icon,
    trafficLevel,
    trafficLabel: trafficLabels[trafficLevel],
    delayMinutes,
    incidentCount,
  };
}
