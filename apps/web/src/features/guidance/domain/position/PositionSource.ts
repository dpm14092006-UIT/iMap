/** Một lần đo vị trí GPS của thiết bị. */
export type PositionFix = {
  lat: number;
  lng: number;
  /** Sai số ước tính (mét). */
  accuracyMeters: number;
  /** Hướng di chuyển (độ, 0 = Bắc) nếu nguồn biết; null để engine tự suy ra từ chuyển động. */
  headingDegrees: number | null;
  /** Tốc độ GPS cung cấp, tính bằng m/s; null nếu không có số đo. */
  speedMetersPerSecond: number | null;
  /** Thời điểm đo GPS, tính bằng mili giây Unix. */
  timestampMs: number;
};

export type PositionErrorCode = 'unsupported' | 'permission-denied' | 'timeout' | 'unavailable';
export type PositionError = { code: PositionErrorCode; message: string };

/** Nguồn vị trí cho engine dẫn đường. */
export interface PositionSource {
  start(onFix: (fix: PositionFix) => void, onError: (error: PositionError) => void): void;
  stop(): void;
}
