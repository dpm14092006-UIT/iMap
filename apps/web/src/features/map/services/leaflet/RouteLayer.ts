import * as L from 'leaflet';
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
import { COLORS, drawWhiteCasing, MOBILE_QUERY, ROUND, textElement, toLatLngs } from './drawing';

/** Số đoạn dùng để mô phỏng dải màu gradient dọc theo tuyến (Leaflet không hỗ trợ gradient). */
const GRADIENT_SEGMENTS = 28;

/**
 * Tuyến đang chọn (gradient hoặc màu ùn tắc), các phương án phụ (bấm để chọn), nhãn thời gian trên tuyến
 * và marker điểm dừng / điểm đi-đến nháp.
 */
export class RouteLayer {
  private readonly routes = L.layerGroup();
  private readonly labels = L.layerGroup();
  private lastLabels: { routes: RoutePlan[]; selected: RoutePlan } | null = null;
  private readonly mobileQuery = window.matchMedia(MOBILE_QUERY);
  private readonly onZoomEnd = () => this.separateRouteLabels();
  private readonly onMobileChange = () => this.redrawLabels();

  constructor(
    private readonly map: L.Map,
    private readonly language: () => Language,
    private readonly onSelectRoute?: (routeId: string) => void,
  ) {
    this.mobileQuery.addEventListener('change', this.onMobileChange);
    map.on('zoomend', this.onZoomEnd);
  }

  /** Thêm vào bản đồ (thứ tự thêm quyết định lớp nào nằm trên). */
  addRoutesTo(map: L.Map) {
    this.routes.addTo(map);
  }
  addLabelsTo(map: L.Map) {
    this.labels.addTo(map);
  }

  clear() {
    this.routes.clearLayers();
    this.labels.clearLayers();
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
    if (showOptions) this.drawAlternativeRoutes(routeOptions, route.id, showCongestion);
    this.drawRoute(route, isNavigating, showCongestion);
    if (showOptions) this.drawRouteLabels(routeOptions, route);
  }

  /** Marker A/B cho điểm đi/đến đã chọn nhưng chưa tính tuyến. */
  drawDraftStops({ origin, destination }: DraftStops) {
    if (origin) this.drawStopMarker(origin, 'A', COLORS.start);
    if (destination) this.drawStopMarker(destination, 'B', COLORS.end);
  }

  destroy() {
    this.mobileQuery.removeEventListener('change', this.onMobileChange);
    this.map.off('zoomend', this.onZoomEnd);
    this.clear();
  }

  private drawRoute(route: RoutePlan, isNavigating: boolean, showCongestion = false) {
    const congestion = showCongestion && route.congestion?.segments.length ? route.congestion : null;
    for (const leg of route.legs) {
      const points = toLatLngs(leg.points);
      if (points.length < 2) continue;
      if (congestion && route.legs.length === 1) {
        this.drawCongestionLine(leg.points, congestion.segments);
        continue;
      }
      drawWhiteCasing(points, this.routes);
      this.drawGradientLine(points);
    }
    route.stops.forEach((place, index) => {
      if (isNavigating && index === 0) return;
      const isLast = index === route.stops.length - 1;
      // Tuyến 1 chặng dùng nhãn A/B, nhiều điểm dùng số thứ tự.
      const label = index === 0 ? 'A' : route.kind === 'route' ? 'B' : String(index);
      this.drawStopMarker(place, label, route.kind === 'route' && isLast ? COLORS.end : COLORS.start);
    });
  }

  /**
   * Tuyến chọn kiểu Google Maps: viền tối bên dưới, mỗi đoạn tô theo mức ùn tắc VietMap.
   * Đoạn 'unknown' giữ dải màu thương hiệu của tuyến thường.
   */
  private drawCongestionLine(
    coordinates: Coordinate[],
    segments: NonNullable<RoutePlan['congestion']>['segments'],
  ) {
    const parts = splitRouteByCongestion(coordinates, segments);
    const casing = { ...ROUND, interactive: false } as const;
    L.polyline(toLatLngs(coordinates), { ...casing, color: '#1e293b', weight: 10.5, opacity: 0.92 }).addTo(
      this.routes,
    );
    // Mức nặng vẽ sau cùng để không bị đoạn thoáng liền kề che chỗ nối.
    [...parts]
      .sort((a, b) => CONGESTION_RANK[a.level] - CONGESTION_RANK[b.level])
      .forEach(({ level, points }) => {
        const latLngs = toLatLngs(points);
        const color = CONGESTION_COLORS[level];
        if (color) L.polyline(latLngs, { ...casing, color, weight: 6, opacity: 1 }).addTo(this.routes);
        else this.drawGradientLine(latLngs);
      });
  }

  /** Tô tuyến chọn bằng dải màu indigo → teal: chia thành nhiều đoạn, mỗi đoạn một màu nội suy. */
  private drawGradientLine(points: L.LatLng[]) {
    const segments = Math.min(GRADIENT_SEGMENTS, points.length - 1);
    for (let index = 0; index < segments; index++) {
      const from = Math.floor((index * (points.length - 1)) / segments);
      const to = Math.floor(((index + 1) * (points.length - 1)) / segments);
      const ratio = (index + 0.5) / segments;
      const color = COLORS.routeFrom.map((start, channel) =>
        Math.round(start + (COLORS.routeTo[channel]! - start) * ratio),
      );
      L.polyline(points.slice(from, to + 1), {
        ...ROUND,
        color: `rgb(${color.join(',')})`,
        weight: 5.5,
        opacity: 1,
        interactive: false,
      }).addTo(this.routes);
    }
  }

  /** Vẽ các phương án không được chọn thành nét xám-tím nhạt; bấm vào để chọn tuyến đó. */
  private drawAlternativeRoutes(routes: RoutePlan[], selectedId: string, showCongestion = false) {
    for (const route of routes) {
      if (route.id === selectedId) continue;
      for (const leg of route.legs) {
        const points = toLatLngs(leg.points);
        if (points.length < 2) continue;
        // Viền xám đậm giúp nét phụ nổi trên cả nền sáng lẫn nền tối.
        L.polyline(points, {
          ...ROUND,
          color: '#475569',
          weight: 9,
          opacity: 0.55,
          interactive: false,
        }).addTo(this.routes);
        L.polyline(points, { ...ROUND, color: COLORS.alternative, weight: 5.5, opacity: 0.95 })
          .on('click', (event) => {
            L.DomEvent.stopPropagation(event);
            this.onSelectRoute?.(route.id);
          })
          .addTo(this.routes);
        // Lớp mảnh theo mức ùn tắc nằm trên nét xám-tím; không tương tác nên bấm vẫn chọn tuyến.
        if (showCongestion && route.congestion?.segments.length && route.legs.length === 1) {
          for (const part of splitRouteByCongestion(leg.points, route.congestion.segments)) {
            const color = CONGESTION_COLORS[part.level];
            if (!color) continue;
            L.polyline(toLatLngs(part.points), {
              ...ROUND,
              color,
              weight: 2.5,
              opacity: 1,
              interactive: false,
            }).addTo(this.routes);
          }
        }
      }
    }
  }

  /**
   * Nhãn thời gian giữa mỗi tuyến: tuyến chọn nền gradient, tuyến phụ nền trắng. Mỗi nhãn nằm ở điểm
   * xa các tuyến khác nhất. Điện thoại chỉ hiện thời gian + chấm ùn tắc.
   */
  private drawRouteLabels(routes: RoutePlan[], selected: RoutePlan) {
    this.labels.clearLayers();
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
      const icon = L.divIcon({
        className: 'routetwin-route-label-wrap',
        html: `<button type='button' class='routetwin-route-label${compact ? ' is-compact' : ''}${isSelected ? ' is-selected' : ''}' aria-label='${translate(language, 'Chọn tuyến {route}', { route: title })}' title='${title}'>${body}</button>`,
        iconSize: [0, 0],
      });
      const [lat, lng] = points[index]!;
      L.marker([lat, lng], { icon, keyboard: false, zIndexOffset: isSelected ? 600 : 400 })
        .on('click', (event) => {
          L.DomEvent.stopPropagation(event);
          this.onSelectRoute?.(route.id);
        })
        .addTo(this.labels);
    });
    this.separateRouteLabels();
  }

  /**
   * Nhãn của các tuyến gần nhau (cùng xuất phát, nhập lại đoạn chung) dễ chồng lên nhau ở mức zoom
   * nhỏ: đo nhãn trên màn hình, nhãn tuyến đang chọn giữ chỗ, các nhãn còn lại dời lên/xuống tới chỗ trống.
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
    const icon = L.divIcon({
      className: 'routetwin-route-marker',
      html: `<span style="--marker-color:${color}">${label}</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    const marker = L.marker([place.lat, place.lng], { icon, keyboard: false }).addTo(this.routes);
    marker.bindTooltip(textElement('span', place.name), {
      direction: 'top',
      className: 'routetwin-tooltip',
    });
  }
}
