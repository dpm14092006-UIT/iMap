import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Coordinate } from '../../map/types';
import type { LatLng } from '../../places/types';
import { sameTerm } from '../data/poiCatalog';
import { poiErrorMessage } from '../services/poiErrors';
import { ALONG_ROUTE_RADIUS_M, poiSortsByMode, sortPois } from '../services/poiOptions';
import type { Poi, PoiProvider, PoiSearchTerm, PoiSort } from '../types';

export type PoiMode = 'nearby' | 'alongRoute';
export type PoiRequest = { mode: PoiMode; term: PoiSearchTerm };
export type PoiSearchStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Làm tròn tọa độ tâm để kéo bản đồ nhẹ không làm tải lại kết quả. */
const CENTER_STEP = 0.005;
const snap = (value: number) => Math.round(value / CENTER_STEP) * CENTER_STEP;

type Options = {
  provider: PoiProvider;
  /** Tâm bản đồ hiện tại (dùng khi bật "cập nhật khi di chuyển bản đồ"). */
  mapCenter: LatLng;
  /** Đường đi của tuyến đang chọn, dùng cho tìm dọc tuyến (ổn định theo tuyến). */
  routePath: Coordinate[] | null;
};

type Result = {
  request: PoiRequest;
  lat: number;
  lng: number;
  routePath: Coordinate[] | null;
  radiusM: number;
  attempt: number;
  pois: Poi[];
  error: string | null;
};

const defaultSort = (mode: PoiMode): PoiSort => poiSortsByMode[mode][0]!;

/** Trạng thái tìm địa điểm quanh đây / dọc tuyến: từ khóa, bán kính, sắp xếp, kết quả thật và địa điểm đã lưu. */
export function usePoiSearch({ provider, mapCenter, routePath }: Options) {
  const [request, setRequest] = useState<PoiRequest | null>(null);
  const [anchor, setAnchor] = useState<LatLng>(mapCenter);
  const [followMap, setFollowMap] = useState(false);
  const [radiusM, setRadiusM] = useState(ALONG_ROUTE_RADIUS_M);
  const [sortChoice, setSort] = useState<PoiSort>('route');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(() => new Set());

  const center = followMap ? mapCenter : anchor;
  const lat = snap(center.lat);
  const lng = snap(center.lng);

  useEffect(() => {
    if (!request) return;
    if (request.mode === 'alongRoute' && !routePath) return;
    // Đổi từ khóa/bán kính/tâm thì hủy yêu cầu cũ, kết quả cũ không được ghi đè.
    const controller = new AbortController();
    const search =
      request.mode === 'nearby'
        ? provider.nearby({ lat, lng }, request.term, radiusM, controller.signal)
        : provider.alongRoute(routePath!, request.term, radiusM, controller.signal);
    const done = (pois: Poi[], error: string | null) => {
      if (!controller.signal.aborted)
        setResult({ request, lat, lng, routePath, radiusM, attempt, pois, error });
    };
    search.then(
      (pois) => done(pois, null),
      (cause: unknown) => done([], poiErrorMessage(cause)),
    );
    return () => controller.abort();
  }, [provider, request, lat, lng, routePath, radiusM, attempt]);

  const isCurrent =
    result !== null &&
    result.request === request &&
    result.radiusM === radiusM &&
    result.attempt === attempt &&
    result.routePath === routePath &&
    (request?.mode === 'alongRoute' || (result.lat === lat && result.lng === lng));
  const status: PoiSearchStatus = !request
    ? 'idle'
    : request.mode === 'alongRoute' && !routePath
      ? 'idle'
      : !isCurrent
        ? 'loading'
        : result.error !== null
          ? 'error'
          : 'ready';
  // Đang tải lại cùng từ khóa (đổi bán kính, kéo bản đồ) thì giữ kết quả cũ mờ đi thay vì nháy trống.
  const keepsOld =
    result !== null &&
    request !== null &&
    result.request.mode === request.mode &&
    sameTerm(result.request.term, request.term);
  const sort =
    request && !poiSortsByMode[request.mode].includes(sortChoice) ? defaultSort(request.mode) : sortChoice;
  const pois = useMemo(
    () => (request && keepsOld ? sortPois(result!.pois, sort, request.mode) : []),
    [request, keepsOld, result, sort],
  );

  const open = useCallback((next: PoiRequest, at: LatLng, nextRadiusM: number) => {
    setRequest(next);
    setAnchor(at);
    setRadiusM(nextRadiusM);
    setSort(defaultSort(next.mode));
  }, []);
  const close = useCallback(() => setRequest(null), []);
  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  const toggleSaved = useCallback((id: string) => {
    setSavedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  return {
    request,
    radiusM,
    setRadiusM,
    sort,
    setSort,
    followMap,
    setFollowMap,
    status,
    error: status === 'error' ? result!.error : null,
    pois,
    savedIds,
    open,
    close,
    retry,
    toggleSaved,
  };
}

export type PoiSearchController = ReturnType<typeof usePoiSearch>;
