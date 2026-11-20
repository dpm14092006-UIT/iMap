import type { RouteInstruction } from '@routetwin/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { bearingDegrees, haversineMeters } from '../../../shared/geo/distance';
import { toLatLng, type LatLng } from '../../../shared/geo/types';
import type { RoutePlan } from '../../routing/types';
import { NavigationGuidanceEngine } from '../domain/NavigationGuidanceEngine';
import type { PositionError, PositionFix, PositionSource } from '../domain/position/PositionSource';
import { SpeedEstimator } from '../domain/position/SpeedEstimator';
import { BrowserGpsSource } from '../services/BrowserGpsSource';
import type { NavigationStatus } from '../types';

export type NavigationSessionState = {
  status: NavigationStatus;
  route: RoutePlan | null;
  /** Vị trí GPS thô: dùng cho tính lại tuyến, gắn báo cáo… */
  location: LatLng | null;
  /** Vị trí vẽ mũi tên trên bản đồ (đã hút về tuyến khi còn đúng tuyến). */
  displayLocation: LatLng | null;
  headingDegrees: number | null;
  speedKph: number | null;
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
  displayLocation: null,
  headingDegrees: null,
  speedKph: null,
  nextInstruction: null,
  distanceToInstructionMeters: 0,
  distanceRemainingMeters: 0,
  progressRatio: 0,
  offRoute: false,
  offRouteFixes: 0,
  nextStopIndex: 1,
  error: '',
};

function initialRouteHeading(route: RoutePlan): number | null {
  const firstLeg = route.legs.find((leg) => leg.points.length >= 2);
  const start = firstLeg?.points[0];
  const next = firstLeg?.points[1];
  if (!start || !next) return null;
  return bearingDegrees(toLatLng(start), toLatLng(next));
}

/** Track device GPS only during a journey explicitly started by the user. */
export function useNavigationSession() {
  const [state, setState] = useState<NavigationSessionState>(idleState);
  const sourceRef = useRef<PositionSource | null>(null);
  const engineRef = useRef<NavigationGuidanceEngine | null>(null);
  const progressRatioRef = useRef(0);
  const previousLocationRef = useRef<LatLng | null>(null);
  const headingRef = useRef<number | null>(null);
  const speedEstimatorRef = useRef(new SpeedEstimator());

  const stopSource = useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current = null;
  }, []);

  const stop = useCallback(() => {
    stopSource();
    engineRef.current = null;
    progressRatioRef.current = 0;
    previousLocationRef.current = null;
    headingRef.current = null;
    speedEstimatorRef.current.reset();
    setState(idleState);
  }, [stopSource]);

  /** Mỗi lần có vị trí GPS mới: hỏi engine chỉ dẫn tiếp theo, lệch tuyến, đã tới nơi chưa. */
  const handleFix = useCallback(
    (fix: PositionFix) => {
      const engine = engineRef.current;
      if (!engine) return;
      const location = { lat: fix.lat, lng: fix.lng };
      const previousLocation = previousLocationRef.current;
      const movementMeters = previousLocation ? haversineMeters(previousLocation, location) : 0;
      const derivedHeading =
        previousLocation && movementMeters >= Math.max(5, fix.accuracyMeters * 0.5)
          ? bearingDegrees(previousLocation, location)
          : null;
      const headingDegrees = fix.headingDegrees ?? derivedHeading ?? headingRef.current;
      const speedKph = speedEstimatorRef.current.update(fix);
      previousLocationRef.current = location;
      headingRef.current = headingDegrees;
      const guidance = engine.evaluate(location, fix.accuracyMeters, progressRatioRef.current);
      progressRatioRef.current = guidance.progressRatio;
      setState((current) => {
        // GPS quá kém: giữ nguyên kết luận lệch/đúng tuyến của lần trước, không đếm thêm.
        const offRoute = guidance.arrived ? false : guidance.reliable ? guidance.offRoute : current.offRoute;
        const offRouteFixes =
          guidance.arrived || !offRoute
            ? 0
            : guidance.reliable
              ? current.offRouteFixes + 1
              : current.offRouteFixes;
        return {
          ...current,
          status: guidance.arrived ? 'arrived' : 'navigating',
          location,
          displayLocation: guidance.displayLocation,
          headingDegrees,
          speedKph: guidance.arrived ? null : speedKph,
          nextInstruction: guidance.nextInstruction,
          distanceToInstructionMeters: guidance.distanceToInstructionMeters,
          distanceRemainingMeters: guidance.distanceRemainingMeters,
          progressRatio: guidance.progressRatio,
          offRoute,
          offRouteFixes,
          nextStopIndex: guidance.nextStopIndex,
          error: '',
        };
      });
      if (guidance.arrived) stopSource();
    },
    [stopSource],
  );

  const handleError = useCallback(
    (error: PositionError) => {
      const fatal = error.code === 'permission-denied' || error.code === 'unsupported';
      speedEstimatorRef.current.reset();
      setState((current) => ({
        ...current,
        status: fatal || current.status === 'locating' ? 'error' : 'navigating',
        headingDegrees: error.code === 'unsupported' ? null : current.headingDegrees,
        speedKph: null,
        error: error.message,
      }));
      if (fatal) stopSource();
    },
    [stopSource],
  );

  const start = useCallback(
    (route: RoutePlan) => {
      stopSource();
      engineRef.current = new NavigationGuidanceEngine(route);
      progressRatioRef.current = 0;
      previousLocationRef.current = null;
      headingRef.current = initialRouteHeading(route);
      speedEstimatorRef.current.reset();
      setState({ ...idleState, status: 'locating', route, headingDegrees: headingRef.current });
      const source = new BrowserGpsSource();
      sourceRef.current = source;
      source.start(handleFix, handleError);
    },
    [stopSource, handleFix, handleError],
  );

  const updateRoute = useCallback((route: RoutePlan) => {
    engineRef.current = new NavigationGuidanceEngine(route);
    progressRatioRef.current = 0;
    setState((current) => ({ ...current, route, offRoute: false, offRouteFixes: 0, progressRatio: 0 }));
  }, []);

  useEffect(() => stopSource, [stopSource]);

  return {
    ...state,
    start,
    stop,
    updateRoute,
  };
}
