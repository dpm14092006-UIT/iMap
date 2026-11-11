import { useCallback, useEffect, useRef, useState } from 'react';
import type { RouteInstruction } from '@routetwin/shared';
import type { RoutePlan } from '../../map/types';
import type { LatLng } from '../../places/types';
import { NavigationGuidanceEngine } from '../domain/NavigationGuidanceEngine';

export type NavigationStatus = 'idle' | 'locating' | 'navigating' | 'arrived' | 'error';
export type NavigationSessionState = {
  status: NavigationStatus;
  route: RoutePlan | null;
  location: LatLng | null;
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

/** Theo dõi GPS chỉ trong thời gian người dùng chủ động chạy chuyến đi. */
export function useNavigationSession() {
  const [state, setState] = useState<NavigationSessionState>(idleState);
  const watcherId = useRef<number | null>(null);
  const engineRef = useRef<NavigationGuidanceEngine | null>(null);
  const progressRatioRef = useRef(0);

  const clearWatcher = useCallback(() => {
    if (watcherId.current !== null && navigator.geolocation)
      navigator.geolocation.clearWatch(watcherId.current);
    watcherId.current = null;
  }, []);

  const stop = useCallback(() => {
    clearWatcher();
    engineRef.current = null;
    progressRatioRef.current = 0;
    setState(idleState);
  }, [clearWatcher]);

  const start = useCallback(
    (route: RoutePlan) => {
      clearWatcher();
      engineRef.current = new NavigationGuidanceEngine(route);
      progressRatioRef.current = 0;
      if (!navigator.geolocation) {
        setState({ ...idleState, status: 'error', route, error: 'Thiết bị này không hỗ trợ định vị GPS.' });
        return;
      }

      setState({ ...idleState, status: 'locating', route });
      watcherId.current = navigator.geolocation.watchPosition(
        (position) => {
          const engine = engineRef.current;
          if (!engine) return;
          const location = { lat: position.coords.latitude, lng: position.coords.longitude };
          const guidance = engine.evaluate(location, position.coords.accuracy, progressRatioRef.current);
          progressRatioRef.current = guidance.progressRatio;
          setState((current) => ({
            ...current,
            status: guidance.arrived ? 'arrived' : 'navigating',
            location,
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
