import type { PositionError, PositionFix, PositionSource } from '../domain/position/PositionSource';

/** Đổi lỗi Geolocation của trình duyệt sang lỗi chung kèm thông báo tiếng Việt. */
function toPositionError(error: GeolocationPositionError): PositionError {
  if (error.code === error.PERMISSION_DENIED)
    return { code: 'permission-denied', message: 'Chưa có quyền GPS. Hãy cho phép định vị rồi thử lại.' };
  if (error.code === error.TIMEOUT)
    return { code: 'timeout', message: 'GPS đang bắt tín hiệu. Đang tiếp tục tìm vị trí…' };
  return { code: 'unavailable', message: 'Tín hiệu GPS tạm thời không ổn định.' };
}

/** Theo dõi GPS của thiết bị bằng navigator.geolocation.watchPosition. */
export class BrowserGpsSource implements PositionSource {
  private generation = 0;
  private watcherId: number | null = null;

  start(onFix: (fix: PositionFix) => void, onError: (error: PositionError) => void): void {
    this.stop();
    const generation = this.generation;
    if (!navigator.geolocation) {
      onError({ code: 'unsupported', message: 'Thiết bị này không hỗ trợ định vị GPS.' });
      return;
    }
    this.watcherId = navigator.geolocation.watchPosition(
      (position) => {
        if (generation !== this.generation) return;
        const heading = position.coords.heading;
        onFix({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          headingDegrees:
            typeof heading === 'number' && Number.isFinite(heading) ? ((heading % 360) + 360) % 360 : null,
          speedMetersPerSecond:
            typeof position.coords.speed === 'number' &&
            Number.isFinite(position.coords.speed) &&
            position.coords.speed >= 0
              ? position.coords.speed
              : null,
          timestampMs: Number.isFinite(position.timestamp) ? position.timestamp : Date.now(),
        });
      },
      (error) => {
        if (generation === this.generation) onError(toPositionError(error));
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15_000 },
    );
  }

  stop(): void {
    this.generation++;
    if (this.watcherId !== null && navigator.geolocation) navigator.geolocation.clearWatch(this.watcherId);
    this.watcherId = null;
  }
}
