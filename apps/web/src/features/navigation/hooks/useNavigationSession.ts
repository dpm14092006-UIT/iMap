import { useCallback, useEffect, useRef, useState } from 'react';
import type { RouteInstruction } from '@routetwin/shared';
import type { RoutePlan } from '../../map/types';
import type { LatLng } from '../../places/types';
import { Geodesy } from '../domain/Geodesy';
import { NavigationGuidanceEngine } from '../domain/NavigationGuidanceEngine';

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

function geolocationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) return 'Chưa có quyền GPS. Hãy cho phép định vị rồi thử lại.';
  if (error.code === error.TIMEOUT) return 'GPS đang bắt tín hiệu. Đang tiếp tục tìm vị trí…';
  return 'Tín hiệu GPS tạm thời không ổn định.';
}

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

/** Theo dõi GPS chỉ trong thời gian người dùng chủ động chạy chuyến đi. */
export function useNavigationSession() {
  const [state, setState] = useState<NavigationSessionState>(idleState);
  const watcherId = useRef<number | null>(null);
  const engineRef = useRef<NavigationGuidanceEngine | null>(null);
  const progressRatioRef = useRef(0);
  const previousLocationRef = useRef<LatLng | null>(null);
  const headingRef = useRef<number | null>(null);

  const clearWatcher = useCallback(() => {
    if (watcherId.current !== null && navigator.geolocation)
      navigator.geolocation.clearWatch(watcherId.current);
    watcherId.current = null;
  }, []);

  const stop = useCallback(() => {
    clearWatcher();
    engineRef.current = null;
    progressRatioRef.current = 0;
    previousLocationRef.current = null;
    headingRef.current = null;
    setState(idleState);
  }, [clearWatcher]);

  const start = useCallback(
    (route: RoutePlan) => {
      clearWatcher();
      engineRef.current = new NavigationGuidanceEngine(route);
      progressRatioRef.current = 0;
      previousLocationRef.current = null;
      headingRef.current = initialRouteHeading(route);
      if (!navigator.geolocation) {
        setState({
          ...idleState,
          status: 'error',
          route,
          headingDegrees: null,
          error: 'Thiết bị này không hỗ trợ định vị GPS.',
        });
        return;
      }

      setState({ ...idleState, status: 'locating', route, headingDegrees: headingRef.current });
      watcherId.current = navigator.geolocation.watchPosition(
        (position) => {
          const engine = engineRef.current;
          if (!engine) return;
          const location = { lat: position.coords.latitude, lng: position.coords.longitude };
          const previousLocation = previousLocationRef.current;
          const movementMeters = previousLocation ? Geodesy.distanceMeters(previousLocation, location) : 0;
          const deviceHeading = position.coords.heading;
          const derivedHeading =
            previousLocation && movementMeters >= Math.max(5, position.coords.accuracy * 0.5)
              ? bearingDegrees(previousLocation, location)
              : null;
          const headingDegrees =
            typeof deviceHeading === 'number' && Number.isFinite(deviceHeading)
              ? (deviceHeading + 360) % 360
              : (derivedHeading ?? headingRef.current);
          previousLocationRef.current = location;
          headingRef.current = headingDegrees;
          const guidance = engine.evaluate(location, position.coords.accuracy, progressRatioRef.current);
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
          if (guidance.arrived) clearWatcher();
        },
        (error) => {
          const message = geolocationErrorMessage(error);
          setState((current) => ({
            ...current,
            status:
              error.code === error.PERMISSION_DENIED
                ? 'error'
                : current.status === 'locating'
                  ? 'error'
                  : 'navigating',
            error: message,
          }));
          if (error.code === error.PERMISSION_DENIED) clearWatcher();
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 15_000 },
      );
    },
    [clearWatcher],
  );

  const updateRoute = useCallback((route: RoutePlan) => {
    engineRef.current = new NavigationGuidanceEngine(route);
    progressRatioRef.current = 0;
    setState((current) => ({ ...current, route, offRoute: false, offRouteFixes: 0, progressRatio: 0 }));
  }, []);

  useEffect(() => clearWatcher, [clearWatcher]);

  return { ...state, start, stop, updateRoute };
}
