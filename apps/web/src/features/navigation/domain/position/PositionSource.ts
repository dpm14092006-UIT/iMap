/** Một lần đo vị trí, dù từ GPS thật hay GPS giả lập. */
export type PositionFix = {
  lat: number;
  lng: number;
  /** Sai số ước tính (mét). */
  accuracyMeters: number;
  /** Hướng di chuyển (độ, 0 = Bắc) nếu nguồn biết; null để engine tự suy ra từ chuyển động. */
  headingDegrees: number | null;
};

export type PositionErrorCode = 'unsupported' | 'permission-denied' | 'timeout' | 'unavailable';
export type PositionError = { code: PositionErrorCode; message: string };

/** Hai chế độ dẫn đường: GPS thật của thiết bị, hoặc GPS giả để demo khi ngồi một chỗ. */
export type NavigationMode = 'real' | 'demo';

/**
 * Nguồn vị trí cho dẫn đường (Strategy pattern).
 * useNavigationSession chỉ biết interface này nên đổi Thật ↔ Demo không phải sửa engine dẫn đường.
 */
export interface PositionSource {
  readonly mode: NavigationMode;
  start(onFix: (fix: PositionFix) => void, onError: (error: PositionError) => void): void;
  stop(): void;
}
