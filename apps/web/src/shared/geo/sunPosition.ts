/** Vị trí mặt trời: phương vị (độ, từ Bắc theo chiều kim đồng hồ) và độ cao so với chân trời (độ). */
export type SunPosition = { azimuth: number; altitude: number };

const RAD = Math.PI / 180;

/**
 * Vị trí mặt trời theo công thức gần đúng của NOAA (sai số dưới khoảng 1°, đủ cho chiếu sáng bản đồ).
 * Không tính khúc xạ khí quyển.
 */
export function sunPosition(date: Date, lat: number, lng: number): SunPosition {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - startOfYear) / 86_400_000);
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear + (hours - 12) / 24);

  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const trueSolarMinutes = (((hours * 60 + equationOfTime + 4 * lng) % 1440) + 1440) % 1440;
  const hourAngle = (trueSolarMinutes / 4 - 180) * RAD;
  const phi = lat * RAD;

  const cosZenith = Math.min(
    1,
    Math.max(
      -1,
      Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle),
    ),
  );
  const zenith = Math.acos(cosZenith);
  // Phương vị từ Bắc, theo chiều kim đồng hồ.
  const azimuth =
    (Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(phi) - Math.tan(declination) * Math.cos(phi),
    ) /
      RAD +
      180) %
    360;
  return { azimuth, altitude: 90 - zenith / RAD };
}
