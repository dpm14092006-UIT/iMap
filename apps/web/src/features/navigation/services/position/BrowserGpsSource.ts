import type { PositionError, PositionFix, PositionSource } from '../../domain/position/PositionSource';

/** Đổi lỗi Geolocation của trình duyệt sang lỗi chung kèm thông báo tiếng Việt. */
function toPositionError(error: GeolocationPositionError): PositionError {
  if (error.code === error.PERMISSION_DENIED)
    return { code: 'permission-denied', message: 'Chưa có quyền GPS. Hãy cho phép định vị rồi thử lại.' };
  if (error.code === error.TIMEOUT)
    return { code: 'timeout', message: 'GPS đang bắt tín hiệu. Đang tiếp tục tìm vị trí…' };
  return { code: 'unavailable', message: 'Tín hiệu GPS tạm thời không ổn định.' };
}

/** Chế độ Thật: theo dõi GPS của thiết bị bằng navigator.geolocation.watchPosition. */
export class BrowserGpsSource implements PositionSource {
  readonly mode = 'real' as const;
  private watcherId: number | null = null;

  start(onFix: (fix: PositionFix) => void, onError: (error: PositionError) => void): void {
    this.stop();
    if (!navigator.geolocation) {
      onError({ code: 'unsupported', message: 'Thiết bị này không hỗ trợ định vị GPS.' });
      return;
    }
    this.watcherId = navigator.geolocation.watchPosition(
      (position) => {
        const heading = position.coords.heading;
        onFix({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          headingDegrees:
            typeof heading === 'number' && Number.isFinite(heading) ? (heading + 360) % 360 : null,
        });
      },
      (error) => onError(toPositionError(error)),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15_000 },
    );
  }

  stop(): void {
    if (this.watcherId !== null && navigator.geolocation) navigator.geolocation.clearWatch(this.watcherId);
    this.watcherId = null;
  }
}
