import type { RouteInstruction } from '@routetwin/shared';
import type { RoutePlan } from '../../map/types';
import type { LatLng } from '../../places/types';
import { Geodesy } from './Geodesy';
import { RoutePath, type PathMatch } from './RoutePath';

/** Kết quả của một lần đánh giá vị trí GPS so với tuyến. */
export type Guidance = {
  nextInstruction: RouteInstruction | null;
  distanceToInstructionMeters: number;
  distanceRemainingMeters: number;
  /** Tỷ lệ đã đi được, 0..1, truyền lại làm `previousProgressRatio` cho lần đánh giá kế tiếp. */
  progressRatio: number;
  offRoute: boolean;
  /**
   * Lần GPS này đủ chính xác để tính vào bộ đếm lệch tuyến hay không.
   * Sai số quá lớn (trong phố nhiều nhà cao tầng) thì không kết luận được là lệch hay không.
   */
  reliable: boolean;
  /**
   * Vị trí để vẽ mũi tên: khi còn trên tuyến thì "hút" về điểm gần nhất trên tuyến
   * (như các app dẫn đường) để GPS nhiễu không làm mũi tên trôi sang đường bên cạnh;
   * khi lệch tuyến thì giữ nguyên vị trí GPS để người dùng thấy mình đang ở đâu.
   */
  displayLocation: LatLng;
  /** Chỉ số điểm dừng kế tiếp trong `route.stops` (≥ 1). */
  nextStopIndex: number;
  arrived: boolean;
};

/**
 * Biến vị trí GPS thành chỉ dẫn: còn bao xa, rẽ gì tiếp theo, có lệch tuyến hay đã đến nơi.
 * Một engine gắn với một tuyến; tạo engine mới khi tuyến đổi (ví dụ sau khi tính lại).
 */
export class NavigationGuidanceEngine {
  /**
   * Ngưỡng lệch tuyến = sai số GPS × 1,5, kẹp trong [MIN, MAX] mét.
   * MIN đủ nhỏ để bắt được việc rẽ nhầm sang đường song song (phố nội thành cách nhau ~50–100 m);
   * MAX giữ cho GPS kém không nới ngưỡng tới vài trăm mét làm mất hẳn khả năng phát hiện lệch tuyến.
   */
  static readonly MIN_OFF_ROUTE_METERS = 40;
  static readonly MAX_OFF_ROUTE_METERS = 120;
  /** Sai số GPS lớn hơn mức này (mét) thì lần đo không được tính là lệch hay đúng tuyến. */
  static readonly UNRELIABLE_ACCURACY_METERS = 100;
  /** Cách điểm cuối trong bán kính này (mét) thì coi là đã đến. */
  static readonly ARRIVAL_RADIUS_METERS = 35;
  /** Còn lại ít hơn quãng này (mét) trên tuyến thì coi là đã đến. */
  static readonly ARRIVAL_REMAINING_METERS = 15;
  /** Điểm dừng chỉ được tính là "đã qua" khi nằm trong bán kính này (mét) của tuyến. */
  private static readonly STOP_MATCH_RADIUS_METERS = 250;
  private static readonly STOP_PASSED_TOLERANCE_METERS = 30;
  /** Ưu tiên đoạn "phía trước" nếu nó không xa hơn đoạn gần nhất quá mức này (mét). */
  private static readonly FORWARD_PREFERENCE_METERS = 100;

  private readonly path: RoutePath;
  /** Quãng đường theo VietMap (mét); dùng làm thước đo chính, hình học chỉ để định vị. */
  private readonly routeMeters: number;
  private readonly instructions: RouteInstruction[];
  /**
   * Vị trí trên tuyến của từng điểm dừng (theo chỉ số trong `route.stops`), tính một lần khi tạo engine.
   * Trước đây khớp lại mọi điểm dừng với toàn bộ tuyến mỗi lần có GPS (≈ số điểm × số đoạn mỗi giây).
   */
  private readonly stopMatches: (PathMatch | null)[];

  constructor(private readonly route: RoutePlan) {
    this.path = new RoutePath(route.legs);
    this.routeMeters = route.distanceKm > 0 ? route.distanceKm * 1000 : this.path.totalMeters;
    this.instructions = route.legs.flatMap((leg) => leg.instructions ?? []);
    this.stopMatches = route.stops.map((stop, index) => (index === 0 ? null : this.path.closest(stop)));
  }

  evaluate(point: LatLng, accuracyMeters: number, previousProgressRatio: number): Guidance {
    const geometryTotal = this.path.totalMeters;
    const expectedProgress = previousProgressRatio * geometryTotal;
    const backtrackAllowance = Math.max(60, geometryTotal * 0.025);
    const anywhere = this.path.closest(point);
    const forward = this.path.closest(point, expectedProgress - backtrackAllowance);
    const nearest =
      forward &&
      (!anywhere ||
        forward.distance <= anywhere.distance + NavigationGuidanceEngine.FORWARD_PREFERENCE_METERS)
        ? forward
        : anywhere;

    const distanceFromRoute = nearest?.distance ?? Number.POSITIVE_INFINITY;
    const geometryProgress = nearest?.progress ?? 0;
    const progressMeters = geometryTotal > 0 ? (geometryProgress / geometryTotal) * this.routeMeters : 0;
    const progressRatio = this.routeMeters > 0 ? progressMeters / this.routeMeters : 0;
    const distanceRemainingMeters = Math.max(0, this.routeMeters - progressMeters);
    const { nextInstruction, distanceToInstructionMeters } = this.findNextInstruction(progressMeters);
    const offRoute = distanceFromRoute > NavigationGuidanceEngine.offRouteThreshold(accuracyMeters);
    const displayLocation = !offRoute && nearest ? this.path.pointAt(nearest.progress) : point;

    return {
      nextInstruction,
      distanceToInstructionMeters,
      distanceRemainingMeters,
      progressRatio,
      offRoute,
      reliable: accuracyMeters <= NavigationGuidanceEngine.UNRELIABLE_ACCURACY_METERS,
      displayLocation,
      nextStopIndex: this.findNextStopIndex(geometryProgress),
      arrived: !offRoute && this.hasArrived(point, progressRatio, distanceRemainingMeters),
    };
  }

  /** Khoảng cách tới tuyến (mét) vượt quá mức này thì coi là lệch tuyến. */
  static offRouteThreshold(accuracyMeters: number): number {
    const { MIN_OFF_ROUTE_METERS, MAX_OFF_ROUTE_METERS } = NavigationGuidanceEngine;
    return Math.min(MAX_OFF_ROUTE_METERS, Math.max(MIN_OFF_ROUTE_METERS, accuracyMeters * 1.5));
  }

  /** Chỉ dẫn hiện tại: chỉ dẫn đầu tiên mà điểm kết thúc của nó còn ở phía trước. */
  private findNextInstruction(progressMeters: number) {
    const totalInstructionMeters = this.instructions.reduce(
      (sum, step) => sum + Math.max(0, step.distanceMeters),
      0,
    );
    // Quy đổi để tổng độ dài chỉ dẫn khớp quãng đường tuyến (hai số này có thể lệch nhẹ).
    const scale = totalInstructionMeters > 0 ? this.routeMeters / totalInstructionMeters : 1;
    let endMeters = 0;
    for (const step of this.instructions) {
      endMeters += Math.max(0, step.distanceMeters) * scale;
      if (step.distanceMeters > 0 && endMeters >= progressMeters) {
        return {
          nextInstruction: step,
          distanceToInstructionMeters: Math.max(0, endMeters - progressMeters),
        };
      }
    }
    return { nextInstruction: null, distanceToInstructionMeters: 0 };
  }

  private hasArrived(point: LatLng, progressRatio: number, distanceRemainingMeters: number): boolean {
    const { stops } = this.route;
    const destination = stops.at(-1);
    const radius = NavigationGuidanceEngine.ARRIVAL_RADIUS_METERS;
    // Hành trình khép kín (đích = điểm xuất phát): chỉ coi là đến khi đã đi gần hết vòng.
    const isClosedLoop =
      stops.length > 2 &&
      Boolean(stops[0] && destination && Geodesy.distanceMeters(stops[0], destination) <= radius);
    const nearDestination =
      Boolean(destination && Geodesy.distanceMeters(point, destination) <= radius) &&
      (!isClosedLoop || progressRatio >= 0.9);
    return nearDestination || distanceRemainingMeters <= NavigationGuidanceEngine.ARRIVAL_REMAINING_METERS;
  }

  /** Điểm dừng đầu tiên (sau điểm xuất phát) mà người đi chưa vượt qua. */
  private findNextStopIndex(geometryProgress: number): number {
    const { stops } = this.route;
    for (let index = 1; index < stops.length; index++) {
      const match = this.stopMatches[index];
      if (
        match &&
        match.progress >= geometryProgress - NavigationGuidanceEngine.STOP_PASSED_TOLERANCE_METERS &&
        match.distance < NavigationGuidanceEngine.STOP_MATCH_RADIUS_METERS
      ) {
        return index;
      }
    }
    return Math.max(1, stops.length - 1);
  }
}
