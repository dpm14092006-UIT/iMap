import type { RoutePlan } from '../../../map/types';
import type { LatLng } from '../../../places/types';
import { Geodesy } from '../Geodesy';
import { RoutePath } from '../RoutePath';
import type { PositionError, PositionFix, PositionSource } from './PositionSource';

const METERS_PER_DEGREE_LAT = 111_320;

export type SimulationOptions = {
  /** Mỗi nhịp cách nhau bao lâu (ms). */
  tickMs: number;
  /** Mỗi nhịp xe đi được bao xa (mét). Mặc định ~80 m/s, tua nhanh để demo cho gọn. */
  metersPerTick: number;
  /** Khi rẽ nhầm, mỗi nhịp xe lệch thêm bao nhiêu mét (tối đa maxDeviationMeters). */
  deviationStepMeters: number;
  maxDeviationMeters: number;
  /** Sai số giả lập gửi kèm mỗi lần đo (mét). */
  accuracyMeters: number;
};

export const defaultSimulationOptions: SimulationOptions = {
  tickMs: 500,
  metersPerTick: 40,
  deviationStepMeters: 30,
  maxDeviationMeters: 150,
  accuracyMeters: 8,
};

/** Hướng đi (độ, 0 = Bắc, 90 = Đông) từ điểm a tới điểm b. */
function bearingDegrees(a: LatLng, b: LatLng): number {
  const east = (b.lng - a.lng) * METERS_PER_DEGREE_LAT * Math.cos((a.lat * Math.PI) / 180);
  const north = (b.lat - a.lat) * METERS_PER_DEGREE_LAT;
  return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}

/** Dời điểm đi `meters` mét theo hướng `degrees`. */
function move(point: LatLng, degrees: number, meters: number): LatLng {
  const radians = (degrees * Math.PI) / 180;
  return {
    lat: point.lat + (Math.cos(radians) * meters) / METERS_PER_DEGREE_LAT,
    lng:
      point.lng +
      (Math.sin(radians) * meters) / (METERS_PER_DEGREE_LAT * Math.cos((point.lat * Math.PI) / 180)),
  };
}

/**
 * Chế độ Demo — "GPS giả": cho xe chạy dọc tuyến theo nhịp đều, có thể tạm dừng và giả lập rẽ nhầm.
 * Vị trí sinh ra đi qua đúng engine dẫn đường như GPS thật, nên lệch tuyến / tính lại tuyến chạy y hệt.
 */
export class SimulatedGpsSource implements PositionSource {
  readonly mode = 'demo' as const;
  private path: RoutePath;
  private progressMeters: number;
  private deviationMeters = 0;
  private paused = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private onFix: ((fix: PositionFix) => void) | null = null;

  /**
   * @param route tuyến để chạy theo
   * @param startNear bắt đầu từ điểm trên tuyến gần vị trí này nhất (khi chuyển từ Thật sang Demo giữa chừng)
   */
  constructor(
    route: RoutePlan,
    startNear: LatLng | null = null,
    private readonly options = defaultSimulationOptions,
  ) {
    this.path = new RoutePath(route.legs);
    this.progressMeters = startNear ? (this.path.closest(startNear)?.progress ?? 0) : 0;
  }

  start(onFix: (fix: PositionFix) => void, _onError: (error: PositionError) => void): void {
    this.stop();
    this.onFix = onFix;
    this.emit(); // báo vị trí xuất phát ngay, không đợi nhịp đầu
    this.timer = setInterval(() => this.step(), this.options.tickMs);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /** Một nhịp mô phỏng: tiến thêm một đoạn dọc tuyến (public để test không cần đợi timer). */
  step(): void {
    if (this.paused) return;
    this.progressMeters = Math.min(this.path.totalMeters, this.progressMeters + this.options.metersPerTick);
    if (this.deviationMeters > 0) {
      this.deviationMeters = Math.min(
        this.options.maxDeviationMeters,
        this.deviationMeters + this.options.deviationStepMeters,
      );
    }
    this.emit();
  }

  /** Sau khi tính lại tuyến: chạy tiếp theo tuyến mới (tuyến mới bắt đầu tại vị trí hiện tại) và thôi lệch. */
  followRoute(route: RoutePlan): void {
    this.path = new RoutePath(route.legs);
    this.progressMeters = 0;
    this.deviationMeters = 0;
  }

  /** Giả lập rẽ nhầm: xe lệch dần sang phải hướng đi cho tới khi app tính lại tuyến. */
  deviate(): void {
    this.deviationMeters = this.options.deviationStepMeters;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** Vị trí hiện tại (đã cộng độ lệch nếu đang rẽ nhầm). */
  currentPosition(): PositionFix {
    const onRoute = this.path.pointAt(this.progressMeters);
    const ahead = this.path.pointAt(this.progressMeters + 5);
    const heading = Geodesy.distanceMeters(onRoute, ahead) > 0.5 ? bearingDegrees(onRoute, ahead) : null;
    const point =
      this.deviationMeters > 0 && heading !== null
        ? move(onRoute, heading + 90, this.deviationMeters)
        : onRoute;
    return { ...point, accuracyMeters: this.options.accuracyMeters, headingDegrees: heading };
  }

  private emit(): void {
    this.onFix?.(this.currentPosition());
  }
}
