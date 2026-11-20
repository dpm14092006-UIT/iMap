import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { TrafficReportBounds } from '@routetwin/shared';
import { ApiPoiProvider } from '../../../features/explore/api/apiPoiProvider';
import { poiCatalog, sameTerm, termFromText } from '../../../features/explore/domain/poiCatalog';
import { usePoiSearch } from '../../../features/explore/hooks/usePoiSearch';
import { ALONG_ROUTE_RADIUS_M, radiusForZoom } from '../../../features/explore/domain/poiOptions';
import { placeFromPoi } from '../../../features/explore/domain/poiPlace';
import type { Poi, PoiSearchTerm } from '../../../features/explore/types';
import type { ComboboxAction } from '../../../features/places/components/PlaceCombobox';
import type { LeafletMapController } from '../../../features/map/services/LeafletMapController';
import type { DirectionsController } from '../../../features/routing/hooks/useDirections';
import type { RoutePlan } from '../../../features/routing/types';
import { progressAlongPath } from '../../../shared/geo/polyline';
import type { LatLng } from '../../../shared/geo/types';
import type { FeatureKey } from '../../types';
import type { PlaceSelection } from '../workspace/usePlaceSelection';

/** Khi bản đồ đang xem toàn quốc, khám phá quanh đây mặc định ở trung tâm TP.HCM. */
const DEFAULT_EXPLORE_CENTER: LatLng = { lat: 10.7769, lng: 106.7009 };
/** Dưới mức zoom này thì chưa đủ gần để khám phá quanh đây. */
const MIN_EXPLORE_ZOOM = 11;
const EXPLORE_ZOOM = 14;
/** Số ghim gần nhất dùng để thu bản đồ vừa kết quả. */
const FIT_POI_COUNT = 8;
const NO_POIS: Poi[] = [];

type SearchMode = 'nearby' | 'alongRoute';

type Options = {
  trafficBounds: TrafficReportBounds;
  activeRoute: RoutePlan | null;
  activePanel: FeatureKey | null;
  openPanel: (key: FeatureKey | null) => void;
  selection: PlaceSelection;
  directions: DirectionsController;
  currentLocation: LatLng | null;
  mapController: RefObject<LeafletMapController | null>;
  getMapCenter: () => LatLng;
  showToast: (message: string) => void;
  t: (text: string, values?: Record<string, string | number>) => string;
};

/**
 * Khám phá quanh đây / tìm dọc tuyến: địa điểm thật qua PoiProvider -> backend -> VietMap.
 * Gồm tìm kiếm, ghim trên bản đồ, mở chi tiết, chỉ đường tới POI và chèn POI làm điểm ghé.
 */
export function usePoiExplorer(options: Options) {
  const { activeRoute, activePanel, openPanel, selection, directions, mapController, showToast, t } = options;
  const provider = useMemo(() => new ApiPoiProvider(), []);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const { trafficBounds } = options;
  const mapCenter = useMemo<LatLng>(
    () => ({
      lat: (trafficBounds.minLat + trafficBounds.maxLat) / 2,
      lng: (trafficBounds.minLng + trafficBounds.maxLng) / 2,
    }),
    [trafficBounds],
  );
  const routePath = useMemo(
    () => (activeRoute ? activeRoute.legs.flatMap((leg) => leg.points) : null),
    [activeRoute],
  );
  const poi = usePoiSearch({ provider, mapCenter, routePath });
  const visible =
    poi.request !== null &&
    (activePanel === 'poi' || (activePanel === 'place' && selection.selectedPoi !== null));

  // Có kết quả cho lượt tìm mới (đổi loại / từ khóa) thì thu bản đồ vừa các ghim gần nhất, chừa chỗ
  // cho bảng kết quả. Kéo bản đồ / đổi bán kính không thu lại để khỏi giật bản đồ của người dùng.
  const fittedRequest = useRef<unknown>(null);
  useEffect(() => {
    const request = poi.request;
    if (!visible || request?.mode !== 'nearby' || poi.status !== 'ready' || poi.pois.length === 0) return;
    if (fittedRequest.current === request) return;
    fittedRequest.current = request;
    mapController.current?.fitPoints(poi.pois.slice(0, FIT_POI_COUNT));
  }, [visible, poi.request, poi.status, poi.pois, mapController]);

  /** Bỏ lượt tìm POI hiện tại (ghim và highlight), không đổi panel. */
  const dismiss = () => {
    poi.close();
    setHighlightedId(null);
  };
  const close = () => {
    dismiss();
    if (activePanel === 'poi') openPanel(null);
  };

  const start = (mode: SearchMode, term: PoiSearchTerm) => {
    // Bấm lại chip đang chọn thì đóng; gõ lại cùng từ khóa thì tìm lại.
    if (term.category && visible && poi.request?.mode === mode && sameTerm(poi.request.term, term)) {
      close();
      return;
    }
    let anchor = options.getMapCenter();
    let zoom = mapController.current?.getZoom() ?? 0;
    if (mode === 'nearby' && zoom < MIN_EXPLORE_ZOOM) {
      anchor = options.currentLocation ?? DEFAULT_EXPLORE_CENTER;
      zoom = EXPLORE_ZOOM;
      mapController.current?.flyTo(anchor, zoom);
      showToast(t('Đang khám phá quanh TP.HCM. Hãy phóng to bản đồ tới khu vực bạn muốn.'));
    }
    poi.open({ mode, term }, anchor, mode === 'alongRoute' ? ALONG_ROUTE_RADIUS_M : radiusForZoom(zoom));
    selection.clearPlace();
    openPanel('poi');
  };

  const select = (item: Poi) => selection.openPlace(placeFromPoi(item), item);
  const selectById = (id: string) => {
    const item = poi.pois.find((candidate) => candidate.id === id);
    if (item) select(item);
  };

  /** Đóng chi tiết địa điểm: quay về danh sách POI nếu đang có lượt tìm. */
  const closePlacePanel = () => {
    selection.setSelectedPoi(null);
    openPanel(poi.request ? 'poi' : null);
  };

  const directionsTo = (item: Poi) => {
    dismiss();
    selection.openDirections(placeFromPoi(item));
  };

  /** Chèn POI làm điểm ghé giữa điểm đi và đến (theo vị trí dọc tuyến), tính lại tuyến rồi về panel chỉ đường. */
  const addStop = async (item: Poi) => {
    const { origin, destination, route } = directions;
    if (!origin || !destination || !route) return;
    const path = route.legs.flatMap((leg) => leg.points);
    const current = directions.waypoints.flatMap((waypoint) => (waypoint.place ? [waypoint.place] : []));
    const via = [...current, placeFromPoi(item)]
      .filter((place, index, all) => all.findIndex((other) => other.id === place.id) === index)
      .sort((a, b) => progressAlongPath(path, a) - progressAlongPath(path, b));
    dismiss();
    openPanel('directions');
    const result = await directions.open({
      origin,
      destination,
      vehicle: directions.vehicle,
      via,
      objective: directions.objective,
      avoidFerry: directions.avoidFerry,
    });
    if (result) showToast(t('Đã thêm điểm dừng: {name}', { name: item.name }));
  };

  const toggleSaved = (item: Poi) => {
    poi.toggleSaved(item.id);
    showToast(poi.savedIds.has(item.id) ? t('Đã bỏ lưu địa điểm') : t('Đã lưu {name}', { name: item.name }));
  };

  /** Có tuyến và đang ở panel chỉ đường (hoặc đang tìm dọc tuyến) thì ô tìm kiếm tìm dọc tuyến. */
  const alongRouteMode =
    Boolean(activeRoute) && (activePanel === 'directions' || poi.request?.mode === 'alongRoute');
  const activeCategory = visible && poi.request ? (poi.request.term.category ?? null) : null;

  /** Dòng đầu của ô tìm kiếm chung: tìm theo loại/từ khóa quanh đây hoặc dọc tuyến. */
  const buildSearchAction = (text: string): ComboboxAction | null => {
    const term = termFromText(text);
    if (!term) return null;
    const mode: SearchMode = alongRouteMode ? 'alongRoute' : 'nearby';
    const what = term.category ? t(poiCatalog[term.category].label).toLowerCase() : `“${term.query}”`;
    return {
      label: t('Tìm {what} {where}', { what, where: t(alongRouteMode ? 'dọc tuyến' : 'quanh đây') }),
      icon: term.category ? poiCatalog[term.category].icon : 'search',
      preferred: Boolean(term.category),
      onRun: () => start(mode, term),
    };
  };

  return {
    search: poi,
    visiblePois: visible ? poi.pois : NO_POIS,
    highlightedId,
    setHighlightedId,
    alongRouteMode,
    activeCategory,
    dismiss,
    close,
    start,
    select,
    selectById,
    closePlacePanel,
    directionsTo,
    addStop,
    toggleSaved,
    buildSearchAction,
  };
}
