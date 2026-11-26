import {
  formatDistanceKm,
  formatDurationCompact,
  formatDurationMinutes,
} from '../../../../shared/format/units';
import type { Coordinate } from '../../../../shared/geo/types';
import { translate, type Language } from '../../../../shared/i18n/translate';
import { iconSvg } from '../../../../shared/ui/Icon';
import type { Place } from '../../../places/types';
import { minutesSlowerThanFastest, routeLabels } from '../../../routing/domain/routeLabels';
import type { RoutePlan } from '../../../routing/types';
import {
  CONGESTION_COLORS,
  CONGESTION_LABELS,
  CONGESTION_RANK,
  splitRouteByCongestion,
  worstCongestionLevel,
} from '../../../traffic/domain/routeCongestion';
import { pickRouteLabelPoints } from '../../domain/routeLabelPlacement';
import type { DraftStops } from '../../types';
import { coordinateToLngLat, ensureLayer, maplibregl, OverlaySource, withTooltip, type GLMap } from './gl';
import { markerElement } from './markers';
import { MOBILE_QUERY } from './MaplibreCamera';

export const ROUTE_COLORS = {
  start: '#0d9488',
  end: '#004779',
  gradientFrom: '#4338ca',
  gradientTo: '#0d9488',
  alternative: '#a5b4fc',
};
/** Lớp tuyến phụ bấm được để chọn tuyến (MaplibreMapController kiểm tra khi bấm bản đồ). */
export const ALTERNATIVE_ROUTE_LAYER = 'rt-route-alt';

type LineProps = {
  role: string;
  color?: string;
  width?: number;
  opacity?: number;
  routeId?: string;
  rank?: number;
};
type LineFeature = GeoJSON.Feature<GeoJSON.LineString, LineProps>;

const line = (points: Coordinate[], properties: LineProps): LineFeature => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: points.map(coordinateToLngLat) },
  properties,
});

/**
 * Tuyến đang chọn (dải màu hoặc màu ùn tắc), các phương án phụ (bấm để chọn), nhãn thời gian trên tuyến
 * và marker điểm dừng / điểm đi-đến nháp. Nét vẽ là lớp GeoJSON (cài lại sau khi đổi nền); nhãn và
 * marker là phần tử HTML.
 */
export class RouteLayer {
  private readonly lines: OverlaySource;
  /** Tuyến chọn dạng dải màu: nguồn riêng có lineMetrics cho `line-gradient`. */
  private readonly gradient: OverlaySource;
  private stops: maplibregl.Marker[] = [];
  private labels: maplibregl.Marker[] = [];
  private lastLabels: { routes: RoutePlan[]; selected: RoutePlan } | null = null;
  private readonly mobileQuery = window.matchMedia(MOBILE_QUERY);
  private readonly onZoomEnd = () => this.separateRouteLabels();
  private readonly onMobileChange = () => this.redrawLabels();

  constructor(
    private readonly map: GLMap,
    private readonly language: () => Language,
    private readonly onSelectRoute?: (routeId: string) => void,
  ) {
    this.lines = new OverlaySource(map, 'rt-route-lines');
    this.gradient = new OverlaySource(map, 'rt-route-gradient', { lineMetrics: true });
    this.mobileQuery.addEventListener('change', this.onMobileChange);
    map.on('zoomend', this.onZoomEnd);
  }

  /** Cài nguồn và lớp (lần đầu và sau mỗi lần đổi nền). Thứ tự gọi = thứ tự chồng. */
  install() {
    this.lines.install();
    this.gradient.install();
    const byRole = (role: string) => ['==', ['get', 'role'], role] as maplibregl.FilterSpecification;
    const round = { 'line-cap': 'round', 'line-join': 'round' } as const;
    const dataLine = (id: string, role: string, sortByRank = false) =>
      ensureLayer(this.map, {
        id,
        type: 'line',
        source: this.lines.id,
        filter: byRole(role),
        layout: { ...round, ...(sortByRank ? { 'line-sort-key': ['get', 'rank'] } : {}) },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'width'],
          'line-opacity': ['get', 'opacity'],
        },
      });
    dataLine('rt-route-alt-casing', 'alt-casing');
    dataLine(ALTERNATIVE_ROUTE_LAYER, 'alt');
    dataLine('rt-route-alt-congestion', 'alt-congestion');
    dataLine('rt-route-casing', 'casing');
    ensureLayer(this.map, {
      id: 'rt-route-gradient',
      type: 'line',
      source: this.gradient.id,
      layout: round,
      paint: {
        'line-width': 5.5,
        'line-gradient': [
          'interpolate',
          ['linear'],
          ['line-progress'],
          0,
          ROUTE_COLORS.gradientFrom,
          1,
          ROUTE_COLORS.gradientTo,
        ],
      },
    });
    dataLine('rt-route-congestion', 'congestion', true);
  }

  clear() {
    this.lines.clear();
    this.gradient.clear();
    for (const marker of [...this.stops, ...this.labels]) marker.remove();
    this.stops = [];
    this.labels = [];
    this.lastLabels = null;
  }

  hasLabels(): boolean {
    return this.lastLabels !== null;
  }

  /** Vẽ lại nhãn (đổi ngôn ngữ, đổi giữa điện thoại / máy tính). */
  redrawLabels() {
    if (this.lastLabels) this.drawRouteLabels(this.lastLabels.routes, this.lastLabels.selected);
  }

  /** Vẽ tuyến chọn kèm các phương án và nhãn (khi không dẫn đường và tuyến 1 chặng). */
  draw(route: RoutePlan, routeOptions: RoutePlan[], isNavigating: boolean, showCongestion: boolean) {
    const showOptions = !isNavigating && route.kind === 'route';
    const lines: LineFeature[] = [];
    const gradient: LineFeature[] = [];
    if (showOptions) lines.push(...this.alternativeLines(routeOptions, route.id, showCongestion));
    this.selectedLines(route, showCongestion, lines, gradient);
    this.lines.set({ type: 'FeatureCollection', features: lines });
    this.gradient.set({ type: 'FeatureCollection', features: gradient });
    route.stops.forEach((place, index) => {
      if (isNavigating && index === 0) return;
      const isLast = index === route.stops.length - 1;
      // Tuyến 1 chặng dùng nhãn A/B, nhiều điểm dùng số thứ tự.
      const label = index === 0 ? 'A' : route.kind === 'route' ? 'B' : String(index);
      this.drawStopMarker(
        place,
        label,
        route.kind === 'route' && isLast ? ROUTE_COLORS.end : ROUTE_COLORS.start,
      );
    });
    if (showOptions) this.drawRouteLabels(routeOptions, route);
  }

  /** Marker A/B cho điểm đi/đến đã chọn nhưng chưa tính tuyến. */
  drawDraftStops({ origin, destination }: DraftStops) {
    if (origin) this.drawStopMarker(origin, 'A', ROUTE_COLORS.start);
    if (destination) this.drawStopMarker(destination, 'B', ROUTE_COLORS.end);
  }

  destroy() {
    this.mobileQuery.removeEventListener('change', this.onMobileChange);
    this.map.off('zoomend', this.onZoomEnd);
    this.clear();
  }

  /**
   * Tuyến chọn: viền bên dưới để nổi trên mọi nền; đoạn có mức ùn tắc VietMap tô theo mức, đoạn chưa rõ
   * (hoặc khi tắt lớp giao thông) dùng dải màu thương hiệu indigo → teal.
   */
  private selectedLines(
    route: RoutePlan,
    showCongestion: boolean,
    lines: LineFeature[],
    gradient: LineFeature[],
  ) {
    const congestion = showCongestion && route.congestion?.segments.length ? route.congestion : null;
    for (const leg of route.legs) {
      if (leg.points.length < 2) continue;
      if (congestion && route.legs.length === 1) {
        lines.push(line(leg.points, { role: 'casing', color: '#1e293b', width: 10.5, opacity: 0.92 }));
        for (const part of splitRouteByCongestion(leg.points, congestion.segments)) {
          const color = CONGESTION_COLORS[part.level];
          if (color)
            lines.push(
              line(part.points, {
                role: 'congestion',
                color,
                width: 6,
                opacity: 1,
                // Mức nặng vẽ sau cùng để không bị đoạn thoáng liền kề che chỗ nối.
                rank: CONGESTION_RANK[part.level],
              }),
            );
          else gradient.push(line(part.points, { role: 'gradient' }));
        }
        continue;
      }
      lines.push(line(leg.points, { role: 'casing', color: '#ffffff', width: 10, opacity: 0.94 }));
      gradient.push(line(leg.points, { role: 'gradient' }));
    }
  }

  /** Các phương án không được chọn: nét xám-tím nhạt có viền; lớp mảnh màu ùn tắc nằm trên. */
  private alternativeLines(routes: RoutePlan[], selectedId: string, showCongestion: boolean): LineFeature[] {
    const lines: LineFeature[] = [];
    for (const route of routes) {
      if (route.id === selectedId) continue;
      for (const leg of route.legs) {
        if (leg.points.length < 2) continue;
        lines.push(line(leg.points, { role: 'alt-casing', color: '#475569', width: 9, opacity: 0.55 }));
        lines.push(
          line(leg.points, {
            role: 'alt',
            color: ROUTE_COLORS.alternative,
            width: 5.5,
            opacity: 0.95,
            routeId: route.id,
          }),
        );
        if (showCongestion && route.congestion?.segments.length && route.legs.length === 1) {
          for (const part of splitRouteByCongestion(leg.points, route.congestion.segments)) {
            const color = CONGESTION_COLORS[part.level];
            if (color)
              lines.push(line(part.points, { role: 'alt-congestion', color, width: 2.5, opacity: 1 }));
          }
        }
      }
    }
    return lines;
  }

  /**
   * Nhãn thời gian giữa mỗi tuyến: tuyến chọn nền gradient, tuyến phụ nền trắng. Mỗi nhãn nằm ở điểm
   * xa các tuyến khác nhất. Điện thoại chỉ hiện thời gian + chấm ùn tắc.
   */
  private drawRouteLabels(routes: RoutePlan[], selected: RoutePlan) {
    for (const marker of this.labels) marker.remove();
    this.labels = [];
    this.lastLabels = { routes, selected };
    const language = this.language();
    const all = routes.some((route) => route.id === selected.id) ? routes : [selected, ...routes];
    const compact = this.mobileQuery.matches;
    const paths = all.map((route): Coordinate[] => route.legs.flatMap((leg) => leg.points));
    const points = pickRouteLabelPoints(paths);
    all.forEach((route, index) => {
      if (paths[index]!.length < 2) return;
      const isSelected = route.id === selected.id;
      const text = `${formatDurationMinutes(route.durationMin, language)} · ${formatDistanceKm(route.distanceKm, language)}`;
      const labels = routeLabels(route, all).map((label) => translate(language, label));
      const delta = minutesSlowerThanFastest(route, all);
      const hint = [
        ...labels,
        ...(delta >= 1 ? [translate(language, '+{minutes} phút', { minutes: delta })] : []),
      ].join(' · ');
      const title = hint ? `${text} (${hint})` : text;
      const worst = worstCongestionLevel(route.congestion);
      const worstColor = worst ? CONGESTION_COLORS[worst] : null;
      const dot = worstColor
        ? `<i class='routetwin-route-dot' style='background:${worstColor}' title='${translate(language, CONGESTION_LABELS[worst!])}' aria-hidden='true'></i>`
        : '';
      const body = compact
        ? `${dot}<span>${formatDurationCompact(route.durationMin, language)}</span>`
        : `${iconSvg(route.vehicle === 'car' ? 'car' : 'motorcycle', 14)}${dot}<span>${text}</span>${hint ? `<small>${hint}</small>` : ''}`;
      const element = markerElement(
        `routetwin-route-label-wrap${isSelected ? ' is-selected' : ''}`,
        `<button type='button' class='routetwin-route-label${compact ? ' is-compact' : ''}${isSelected ? ' is-selected' : ''}' aria-label='${translate(language, 'Chọn tuyến {route}', { route: title })}' title='${title}'>${body}</button>`,
      );
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        this.onSelectRoute?.(route.id);
      });
      const [lat, lng] = points[index]!;
      this.labels.push(
        new maplibregl.Marker({ element, anchor: 'center' }).setLngLat([lng, lat]).addTo(this.map),
      );
    });
    this.separateRouteLabels();
  }

  /**
   * Nhãn của các tuyến gần nhau dễ chồng lên nhau ở mức zoom nhỏ: đo nhãn trên màn hình, nhãn tuyến đang
   * chọn giữ chỗ, các nhãn còn lại dời lên/xuống tới chỗ trống.
   */
  private separateRouteLabels() {
    const labels = [...this.map.getContainer().querySelectorAll<HTMLElement>('.routetwin-route-label')];
    labels.sort(
      (a, b) => Number(b.classList.contains('is-selected')) - Number(a.classList.contains('is-selected')),
    );
    labels.forEach((label) => label.style.setProperty('--dy', '0px'));
    const placed: DOMRect[] = [];
    const overlaps = (a: DOMRect, b: DOMRect, dy: number) =>
      a.left < b.right + 4 && a.right > b.left - 4 && a.top + dy < b.bottom + 3 && a.bottom + dy > b.top - 3;
    for (const label of labels) {
      const rect = label.getBoundingClientRect();
      const step = rect.height + 6;
      const dy = [0, 1, -1, 2, -2, 3, -3]
        .map((n) => n * step)
        .find((offset) => !placed.some((other) => overlaps(rect, other, offset)));
      const shift = dy ?? 0;
      label.style.setProperty('--dy', `${shift}px`);
      placed.push(new DOMRect(rect.x, rect.y + shift, rect.width, rect.height));
    }
  }

  private drawStopMarker(place: Place, label: string, color: string) {
    const element = withTooltip(
      markerElement('routetwin-route-marker', `<span style="--marker-color:${color}">${label}</span>`),
      place.name,
    );
    this.stops.push(
      new maplibregl.Marker({ element, anchor: 'center' }).setLngLat([place.lng, place.lat]).addTo(this.map),
    );
  }
}
