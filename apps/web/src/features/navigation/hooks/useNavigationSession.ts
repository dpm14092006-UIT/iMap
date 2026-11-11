import { useCallback, useEffect, useRef, useState } from 'react';
import type { RouteInstruction } from '@routetwin/shared';
import type { RoutePlan } from '../../map/types';
import type { LatLng } from '../../places/types';

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

const EARTH_RADIUS_METERS = 6_371_000;

function distanceMeters(a: LatLng, b: LatLng): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latDelta = toRadians(b.lat - a.lat);
  const lngDelta = toRadians(b.lng - a.lng);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(lngDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

function segmentProjection(point: LatLng, start: LatLng, end: LatLng) {
  const latitudeScale = 111_320;
  const longitudeScale = latitudeScale * Math.cos((point.lat * Math.PI) / 180);
  const dx = (end.lng - start.lng) * longitudeScale;
  const dy = (end.lat - start.lat) * latitudeScale;
  const px = (point.lng - start.lng) * longitudeScale;
  const py = (point.lat - start.lat) * latitudeScale;
  const lengthSquared = dx * dx + dy * dy;
  const fraction = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSquared));
  const projected = {
    lat: start.lat + (end.lat - start.lat) * fraction,
    lng: start.lng + (end.lng - start.lng) * fraction,
  };
  return { fraction, distance: distanceMeters(point, projected) };
}

function getGuidance(route: RoutePlan, point: LatLng, accuracyMeters: number, previousProgressRatio: number) {
  const legLengths = route.legs.map((leg) =>
    leg.points.slice(1).reduce((sum, [lat, lng], index) => {
      const [startLat, startLng] = leg.points[index]!;
      return sum + distanceMeters({ lat: startLat, lng: startLng }, { lat, lng });
    }, 0),
  );
  const totalGeometryMeters = legLengths.reduce((sum, length) => sum + length, 0);
  const routeMeters = route.distanceKm > 0 ? route.distanceKm * 1000 : totalGeometryMeters;
  const expectedGeometryProgress = previousProgressRatio * totalGeometryMeters;
  const backtrackAllowance = Math.max(60, totalGeometryMeters * 0.025);
  let bestAny: { distance: number; progress: number } | null = null;
  let bestForward: { distance: number; progress: number } | null = null;
  let geometryOffset = 0;

  for (let legIndex = 0; legIndex < route.legs.length; legIndex++) {
    const leg = route.legs[legIndex]!;
    let legProgressMeters = 0;
    for (let index = 1; index < leg.points.length; index++) {
      const [startLat, startLng] = leg.points[index - 1]!;
      const [endLat, endLng] = leg.points[index]!;
      const start = { lat: startLat, lng: startLng };
      const end = { lat: endLat, lng: endLng };
      const segmentLength = distanceMeters(start, end);
      const projection = segmentProjection(point, start, end);
      const candidate = {
        distance: projection.distance,
        progress: geometryOffset + legProgressMeters + segmentLength * projection.fraction,
      };
      if (!bestAny || candidate.distance < bestAny.distance) bestAny = candidate;
      if (
        candidate.progress >= expectedGeometryProgress - backtrackAllowance &&
        (!bestForward || candidate.distance < bestForward.distance)
      )
        bestForward = candidate;
      legProgressMeters += segmentLength;
    }
    geometryOffset += legLengths[legIndex]!;
  }

  const nearest =
    bestForward && (!bestAny || bestForward.distance <= bestAny.distance + 100) ? bestForward : bestAny;
  const bestDistance = nearest?.distance ?? Number.POSITIVE_INFINITY;
  const bestProgressMeters = nearest?.progress ?? 0;
  const progressMeters =
    totalGeometryMeters > 0 ? (bestProgressMeters / totalGeometryMeters) * routeMeters : 0;
  const progressRatio = routeMeters > 0 ? progressMeters / routeMeters : 0;
  const instructions = route.legs.flatMap((leg) => leg.instructions ?? []);
  const instructionMeters = instructions.reduce((sum, step) => sum + Math.max(0, step.distanceMeters), 0);
  const instructionScale = instructionMeters > 0 ? routeMeters / instructionMeters : 1;
  let instructionEndMeters = 0;
  let nextInstruction: RouteInstruction | null = null;
  let distanceToInstructionMeters = 0;

  for (const step of instructions) {
    instructionEndMeters += Math.max(0, step.distanceMeters) * instructionScale;
    if (step.distanceMeters > 0 && instructionEndMeters >= progressMeters) {
      nextInstruction = step;
      distanceToInstructionMeters = Math.max(0, instructionEndMeters - progressMeters);
      break;
    }
  }

  const destination = route.stops.at(-1);
  const distanceRemainingMeters = Math.max(0, routeMeters - progressMeters);
  const isClosedLoop =
    route.stops.length > 2 &&
    Boolean(route.stops[0] && destination && distanceMeters(route.stops[0]!, destination) <= 35);
  const nearDestination =
    Boolean(destination && distanceMeters(point, destination) <= 35) &&
    (!isClosedLoop || progressRatio >= 0.9);
  const arrived = nearDestination || distanceRemainingMeters <= 15;
  let nextStopIndex = Math.max(1, route.stops.length - 1);
  for (let stopIndex = 1; stopIndex < route.stops.length; stopIndex++) {
    const stop = route.stops[stopIndex]!;
    let geometryOffset = 0;
    let stopProgressMeters = Number.POSITIVE_INFINITY;
    let nearestStopDistance = Number.POSITIVE_INFINITY;
    route.legs.forEach((leg) => {
      let legOffset = 0;
      for (let index = 1; index < leg.points.length; index++) {
        const [startLat, startLng] = leg.points[index - 1]!;
        const [endLat, endLng] = leg.points[index]!;
        const start = { lat: startLat, lng: startLng };
        const end = { lat: endLat, lng: endLng };
        const segmentLength = distanceMeters(start, end);
        const projection = segmentProjection(stop, start, end);
        if (projection.distance < nearestStopDistance) {
          nearestStopDistance = projection.distance;
          stopProgressMeters = geometryOffset + legOffset + segmentLength * projection.fraction;
        }
        legOffset += segmentLength;
      }
      geometryOffset += legOffset;
    });
    if (stopProgressMeters >= bestProgressMeters - 30 && nearestStopDistance < 250) {
      nextStopIndex = stopIndex;
      break;
    }
  }

  return {
    nextInstruction,
    distanceToInstructionMeters,
    distanceRemainingMeters,
    progressRatio,
    offRoute: bestDistance > Math.max(70, accuracyMeters * 1.5),
    nextStopIndex,
    arrived,
  };
}

function geolocationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) return 'Chưa có quyền GPS. Hãy cho phép định vị rồi thử lại.';
  if (error.code === error.TIMEOUT) return 'GPS đang bắt tín hiệu. Đang tiếp tục tìm vị trí…';
  return 'Tín hiệu GPS tạm thời không ổn định.';
}

/** Theo dõi GPS chỉ trong thời gian người dùng chủ động chạy chuyến đi. */
export function useNavigationSession() {
  const [state, setState] = useState<NavigationSessionState>(idleState);
  const watcherId = useRef<number | null>(null);
  const routeRef = useRef<RoutePlan | null>(null);
  const progressRatioRef = useRef(0);

  const clearWatcher = useCallback(() => {
    if (watcherId.current !== null && navigator.geolocation)
      navigator.geolocation.clearWatch(watcherId.current);
    watcherId.current = null;
  }, []);

  const stop = useCallback(() => {
    clearWatcher();
    routeRef.current = null;
    progressRatioRef.current = 0;
    setState(idleState);
  }, [clearWatcher]);

  const start = useCallback(
    (route: RoutePlan) => {
      clearWatcher();
      routeRef.current = route;
      progressRatioRef.current = 0;
      if (!navigator.geolocation) {
        setState({ ...idleState, status: 'error', route, error: 'Thiết bị này không hỗ trợ định vị GPS.' });
        return;
      }

      setState({ ...idleState, status: 'locating', route });
      watcherId.current = navigator.geolocation.watchPosition(
        (position) => {
          const currentRoute = routeRef.current;
          if (!currentRoute) return;
          const location = { lat: position.coords.latitude, lng: position.coords.longitude };
          const guidance = getGuidance(
            currentRoute,
            location,
            position.coords.accuracy,
            progressRatioRef.current,
          );
          progressRatioRef.current = guidance.progressRatio;
          setState((current) => ({
            ...current,
            status: guidance.arrived ? 'arrived' : 'navigating',
            route: currentRoute,
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
    routeRef.current = route;
    progressRatioRef.current = 0;
    setState((current) => ({ ...current, route, offRoute: false, offRouteFixes: 0, progressRatio: 0 }));
  }, []);

  useEffect(() => clearWatcher, [clearWatcher]);

  return { ...state, start, stop, updateRoute };
}
