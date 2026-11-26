export type TrafficLevel = 'smooth' | 'moderate' | 'heavy';

/**
 * "Khu vực này": chỉ là ước tính từ giờ cao điểm và số báo cáo cộng đồng trong khung nhìn.
 * Không có thời tiết: trước đây là số minh họa (26–33°C) trông như dữ liệu thật nên đã bỏ.
 */
export type AreaInsight =
  | {
      /** Khung nhìn đủ nhỏ để tải báo cáo giao thông: có ước tính. */
      status: 'estimated';
      trafficLevel: TrafficLevel;
      trafficLabel: string;
      /** Ước tính (không phải số đo thật) chậm hơn thường lệ bao nhiêu phút; 0 nếu thông thoáng. */
      delayMinutes: number;
      incidentCount: number;
    }
  | {
      /** Bản đồ đang thu nhỏ quá (cả nước, cả khu vực): không có dữ liệu để ước tính. */
      status: 'zoom-in';
    };

const trafficLabels: Record<TrafficLevel, string> = {
  smooth: 'Ước tính: Giao thông thông thoáng',
  moderate: 'Ước tính: Giao thông vừa phải',
  heavy: 'Ước tính: Giao thông đông đúc',
};

/** Giờ cao điểm: 7–9h và 16:30–19h. */
export function isRushHour(now: Date): boolean {
  const hour = now.getHours() + now.getMinutes() / 60;
  return (hour >= 7 && hour < 9) || (hour >= 16.5 && hour < 19);
}

/**
 * Tổng hợp "Khu vực này" từ số sự cố đang báo trong khung nhìn và giờ trong ngày.
 * `canEstimate` = false khi bản đồ thu nhỏ quá mức tải được báo cáo: khi đó không đoán "thông thoáng".
 */
export function computeAreaInsight(incidentCount: number, now = new Date(), canEstimate = true): AreaInsight {
  if (!canEstimate) return { status: 'zoom-in' };
  const rush = isRushHour(now);
  const score =
    (rush ? 1 : 0) + (incidentCount >= 6 ? 3 : incidentCount >= 3 ? 2 : incidentCount >= 1 ? 1 : 0);
  const trafficLevel: TrafficLevel = score >= 3 ? 'heavy' : score >= 1 ? 'moderate' : 'smooth';
  const delayMinutes =
    trafficLevel === 'smooth'
      ? 0
      : Math.min(60, (rush ? 6 : 3) + incidentCount * 2 + (trafficLevel === 'heavy' ? 8 : 0));
  return {
    status: 'estimated',
    trafficLevel,
    trafficLabel: trafficLabels[trafficLevel],
    delayMinutes,
    incidentCount,
  };
}
