import { useCallback, useEffect, useRef, useState } from 'react';
import type { RouteInstruction } from '@routetwin/shared';
import type { RoutePlan } from '../../map/types';
import type { LatLng } from '../../places/types';
import { Geodesy } from '../domain/Geodesy';
import { NavigationGuidanceEngine } from '../domain/NavigationGuidanceEngine';
import type {
  NavigationMode,
  PositionError,
  PositionFix,
  PositionSource,
} from '../domain/position/PositionSource';
import { SimulatedGpsSource } from '../domain/position/SimulatedGpsSource';
import { BrowserGpsSource } from '../services/position/BrowserGpsSource';

export type NavigationStatus = 'idle' | 'locating' | 'navigating' | 'arrived' | 'error';
export type NavigationSessionState = {
  status: NavigationStatus;
  route: RoutePlan | null;
  location: LatLng | null;
  headingDegrees: number | null;
  nextInstruction: RouteInstruction | null;
  distanceToInstructionMeters: number;
  distanceRemainingMeters: number;
  progressRatio: number;
  offRoute: boolean;
  offRouteFixes: number;
  nextStopIndex: number;
  error: string;
};

const idleState: NavigationSessionState = {
  status: 'idle',
  route: null,
  location: null,
  headingDegrees: null,
  nextInstruction: null,
  distanceToInstructionMeters: 0,
  distanceRemainingMeters: 0,
  progressRatio: 0,
  offRoute: false,
  offRouteFixes: 0,
  nextStopIndex: 1,
  error: '',
};

function bearingDegrees(from: LatLng, to: LatLng): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeFrom = toRadians(from.lat);
  const latitudeTo = toRadians(to.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const y = Math.sin(longitudeDelta) * Math.cos(latitudeTo);
  const x =
    Math.cos(latitudeFrom) * Math.sin(latitudeTo) -
    Math.sin(latitudeFrom) * Math.cos(latitudeTo) * Math.cos(longitudeDelta);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function initialRouteHeading(route: RoutePlan): number | null {
  const firstLeg = route.legs.find((leg) => leg.points.length >= 2);
  const start = firstLeg?.points[0];
  const next = firstLeg?.points[1];
  if (!start || !next) return null;
  return bearingDegrees({ lat: start[0], lng: start[1] }, { lat: next[0], lng: next[1] });
}

/** Tạo nguồn vị trí theo chế độ: GPS thật, hoặc GPS giả chạy dọc tuyến (bắt đầu gần `startNear`). */
function createPositionSource(
  mode: NavigationMode,
  route: RoutePlan,
  startNear: LatLng | null,
): PositionSource {
  return mode === 'demo' ? new SimulatedGpsSource(route, startNear) : new BrowserGpsSource();
}

/**
 * Theo dõi vị trí chỉ trong thời gian người dùng chủ động chạy chuyến đi.
 * Vị trí lấy qua PositionSource nên có 2 chế độ chuyển qua lại được:
 * - real: GPS thật của thiết bị
 * - demo: GPS giả cho xe tự chạy dọc tuyến (thuyết trình, test khi ngồi một chỗ)
 */
export function useNavigationSession() {
  const [state, setState] = useState<NavigationSessionState>(idleState);
  const [mode, setModeState] = useState<NavigationMode>('real');
  const [isDemoPaused, setIsDemoPaused] = useState(false);
  const sourceRef = useRef<PositionSource | null>(null);
  const engineRef = useRef<NavigationGuidanceEngine | null>(null);
  const routeRef = useRef<RoutePlan | null>(null);
  const progressRatioRef = useRef(0);
  const previousLocationRef = useRef<LatLng | null>(null);
  const headingRef = useRef<number | null>(null);

  const stopSource = useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current = null;
  }, []);

  const stop = useCallback(() => {
    stopSource();
    engineRef.current = null;
    routeRef.current = null;
    progressRatioRef.current = 0;
    previousLocationRef.current = null;
    headingRef.current = null;
    setIsDemoPaused(false);
    setState(idleState);
  }, [stopSource]);

  /** Mỗi lần có vị trí mới (từ GPS thật hay giả): hỏi engine chỉ dẫn tiếp theo, lệch tuyến, đã tới nơi chưa. */
  const handleFix = useCallback(
    (fix: PositionFix) => {
      const engine = engineRef.current;
      if (!engine) return;
      const location = { lat: fix.lat, lng: fix.lng };
      const previousLocation = previousLocationRef.current;
      const movementMeters = previousLocation ? Geodesy.distanceMeters(previousLocation, location) : 0;
      const derivedHeading =
        previousLocation && movementMeters >= Math.max(5, fix.accuracyMeters * 0.5)
          ? bearingDegrees(previousLocation, location)
          : null;
      const headingDegrees = fix.headingDegrees ?? derivedHeading ?? headingRef.current;
      previousLocationRef.current = location;
      headingRef.current = headingDegrees;
      const guidance = engine.evaluate(location, fix.accuracyMeters, progressRatioRef.current);
      progressRatioRef.current = guidance.progressRatio;
      setState((current) => ({
        ...current,
        status: guidance.arrived ? 'arrived' : 'navigating',
        location,
        headingDegrees,
        nextInstruction: guidance.nextInstruction,
        distanceToInstructionMeters: guidance.distanceToInstructionMeters,
        distanceRemainingMeters: guidance.distanceRemainingMeters,
        progressRatio: guidance.progressRatio,
        offRoute: !guidance.arrived && guidance.offRoute,
        offRouteFixes: !guidance.arrived && guidance.offRoute ? current.offRouteFixes + 1 : 0,
        nextStopIndex: guidance.nextStopIndex,
        error: '',
      }));
      if (guidance.arrived) stopSource();
    },
    [stopSource],
  );

  const handleError = useCallback(
    (error: PositionError) => {
      const fatal = error.code === 'permission-denied' || error.code === 'unsupported';
      setState((current) => ({
        ...current,
        status: fatal || current.status === 'locating' ? 'error' : 'navigating',
        headingDegrees: error.code === 'unsupported' ? null : current.headingDegrees,
        error: error.message,
      }));
      if (fatal) stopSource();
    },
    [stopSource],
  );

  /** Bật nguồn vị trí theo chế độ cho tuyến đang dẫn. */
  const attachSource = useCallback(
    (nextMode: NavigationMode, route: RoutePlan, startNear: LatLng | null) => {
      stopSource();
      const source = createPositionSource(nextMode, route, startNear);
      sourceRef.current = source;
      setModeState(nextMode);
      setIsDemoPaused(false);
      source.start(handleFix, handleError);
    },
    [stopSource, handleFix, handleError],
  );

  const start = useCallback(
    (route: RoutePlan, startMode: NavigationMode = 'real') => {
      engineRef.current = new NavigationGuidanceEngine(route);
      routeRef.current = route;
      progressRatioRef.current = 0;
      previousLocationRef.current = null;
      headingRef.current = initialRouteHeading(route);
      setState({ ...idleState, status: 'locating', route, headingDegrees: headingRef.current });
      attachSource(startMode, route, null);
    },
    [attachSource],
  );

  /**
   * Đổi Thật ↔ Demo giữa chuyến: giữ nguyên tuyến và tiến độ, chỉ đổi nguồn vị trí.
   * Demo bắt đầu từ điểm trên tuyến gần vị trí hiện tại nhất.
   */
  const setMode = useCallback(
    (nextMode: NavigationMode) => {
      const route = routeRef.current;
      if (!route || !engineRef.current) {
        setModeState(nextMode);
        return;
      }
      if (nextMode === sourceRef.current?.mode) return;
      if (nextMode === 'real') setState((current) => ({ ...current, status: 'locating' }));
      attachSource(nextMode, route, previousLocationRef.current);
    },
    [attachSource],
  );

  const updateRoute = useCallback((route: RoutePlan) => {
    engineRef.current = new NavigationGuidanceEngine(route);
    routeRef.current = route;
    progressRatioRef.current = 0;
    // GPS giả chạy tiếp theo tuyến mới (tuyến mới bắt đầu tại vị trí hiện tại).
    if (sourceRef.current instanceof SimulatedGpsSource) sourceRef.current.followRoute(route);
    setState((current) => ({ ...current, route, offRoute: false, offRouteFixes: 0, progressRatio: 0 }));
  }, []);

  /** Điều khiển riêng của chế độ Demo. */
  const toggleDemoPause = useCallback(() => {
    const source = sourceRef.current;
    if (!(source instanceof SimulatedGpsSource)) return;
    source.setPaused(!source.isPaused);
    setIsDemoPaused(source.isPaused);
  }, []);

  const simulateWrongTurn = useCallback(() => {
    const source = sourceRef.current;
    if (source instanceof SimulatedGpsSource) source.deviate();
  }, []);

  useEffect(() => stopSource, [stopSource]);

  return {
    ...state,
    mode,
    isDemoPaused,
    start,
    stop,
    updateRoute,
    setMode,
    toggleDemoPause,
    simulateWrongTurn,
  };
}
