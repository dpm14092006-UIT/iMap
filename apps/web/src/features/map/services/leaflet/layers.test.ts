// @vitest-environment jsdom
import * as L from 'leaflet';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routePlan } from '../../../../testing/fixtures';
import { toTrafficMapLayer } from '../../../traffic/domain/trafficMapLayer';
import type { Poi } from '../../../explore/types';
import { AlgorithmLayer } from './AlgorithmLayer';
import { BaseLayers } from './BaseLayers';
import { FocusPin } from './FocusPin';
import { LifecycleCanvas } from './LifecycleCanvas';
import { LocationLayer } from './LocationLayer';
import { MapCamera } from './MapCamera';
import { PoiLayer } from './PoiLayer';
import { RouteLayer } from './RouteLayer';
import { TrafficLayers } from './TrafficLayers';
let map: L.Map, container: HTMLDivElement;
const originalSvg = L.Browser.svg;
const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
beforeEach(() => {
  media.matches = false;
  media.addEventListener.mockReset();
  media.removeEventListener.mockReset();
  vi.stubGlobal('matchMedia', () => media);
  Object.defineProperty(L.Browser, 'svg', { value: true, configurable: true });
  container = document.createElement('div');
  document.body.append(container);
  Object.defineProperties(container, { clientWidth: { value: 1200 }, clientHeight: { value: 800 } });
  map = L.map(container, { zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView(
    [10, 106],
    14,
  );
});
afterEach(() => {
  map.remove();
  container.remove();
  Object.defineProperty(L.Browser, 'svg', { value: originalSvg, configurable: true });
  vi.unstubAllGlobals();
});
const poi: Poi = {
  id: 'poi-1',
  name: '<img src=x onerror=alert(1)>',
  address: '',
  lat: 10,
  lng: 106,
  category: 'cafe',
  categoryCodes: [],
  distanceFromRouteM: 0,
  positionAlongRouteM: 0,
  detourMin: 0,
};
const incident = {
  id: 'report',
  lat: 10.005,
  lng: 106.005,
  incidentType: 'flood',
  severity: 'high' as const,
  vehicleScope: 'both' as const,
  title: '<script>bad()</script>',
  communityReporterCount: 3,
};
describe('Leaflet layers with real Leaflet objects', () => {
  it('draws and clears algorithm paths, fitting once per overlay key', () => {
    const layer = new AlgorithmLayer();
    layer.group.addTo(map);
    const overlay = {
      key: 'a',
      coverage: null,
      paths: [{ algorithm: 'astar' as const, points: routePlan().legs[0]!.points }],
    };
    expect(layer.update(overlay)).toHaveLength(2);
    expect(layer.group.getLayers()).toHaveLength(1);
    expect(layer.update(overlay)).toBeNull();
    expect(layer.update({ ...overlay, key: 'b' })).toHaveLength(2);
    expect(layer.update(null)).toBeNull();
    expect(layer.group.getLayers()).toHaveLength(0);
  });
  it('draws algorithm coverage while ignoring paths with fewer than two points', () => {
    const layer = new AlgorithmLayer();
    layer.update({
      key: 'a',
      coverage: { south: 10, west: 106, north: 11, east: 107 },
      paths: [{ algorithm: 'dijkstra', points: [] }],
    });
    expect(layer.group.getLayers()).toHaveLength(1);
  });
  it('updates a GPS marker without accumulating layers and removes it when GPS disappears', () => {
    const layer = new LocationLayer();
    layer.group.addTo(map);
    layer.update({ lat: 10, lng: 106 }, false, null);
    layer.update({ lat: 10.1, lng: 106.1 }, false, null);
    expect(layer.group.getLayers()).toHaveLength(1);
    expect((layer.group.getLayers()[0] as L.CircleMarker).getLatLng().lat).toBe(10.1);
    layer.update(null, false, null);
    expect(layer.group.getLayers()).toHaveLength(0);
  });
  it('switches GPS dot to navigation arrow and updates heading', () => {
    const layer = new LocationLayer();
    layer.group.addTo(map);
    layer.update({ lat: 10, lng: 106 }, false, null);
    layer.update({ lat: 10, lng: 106 }, true, 135);
    expect(container.querySelectorAll('.routetwin-navigation-marker')).toHaveLength(1);
    expect(
      (container.querySelector('.routetwin-navigation-marker') as HTMLElement).style.getPropertyValue(
        '--heading-degrees',
      ),
    ).toBe('135deg');
    layer.update({ lat: 10, lng: 106 }, false, null);
    expect(container.querySelector('.routetwin-navigation-marker')).toBeNull();
  });
  it('reuses POI markers while changing highlight and contains untrusted text in a text node', () => {
    const layer = new PoiLayer();
    layer.group.addTo(map);
    const pois = [poi];
    layer.update(pois, null);
    const marker = layer.group.getLayers()[0] as L.Marker;
    layer.update(pois, poi.id);
    expect(layer.group.getLayers()[0]).toBe(marker);
    expect(marker.getElement()?.classList.contains('is-highlighted')).toBe(true);
    const content = marker.getTooltip()?.getContent() as HTMLElement;
    expect(content.textContent).toBe(poi.name);
    expect(content.querySelector('img')).toBeNull();
    layer.update([], null);
    expect(layer.group.getLayers()).toHaveLength(0);
  });
  it('dispatches POI selection without creating a map click', () => {
    const select = vi.fn(),
      click = vi.fn();
    map.on('click', click);
    const layer = new PoiLayer(select);
    layer.group.addTo(map);
    layer.update([poi], null);
    (layer.group.getLayers()[0] as L.Marker).fire('click', { originalEvent: new MouseEvent('click') });
    expect(select).toHaveBeenCalledWith(poi.id);
    expect(click).not.toHaveBeenCalled();
  });
  it('refreshes the focus tooltip when the place name changes at the same coordinates', () => {
    const layer = new FocusPin(map);
    const place = routePlan().stops[0]!;
    layer.show(place);
    layer.show({ ...place, name: 'New name' });
    let marker: L.Marker | undefined;
    map.eachLayer((l) => {
      if (l instanceof L.Marker) marker = l;
    });
    expect((marker?.getTooltip()?.getContent() as HTMLElement).textContent).toBe('New name');
    layer.show(null);
    expect(container.querySelector('.routetwin-focus-marker')).toBeNull();
  });
  it('draws only active incidents, showing reporter count safely', () => {
    const traffic = new TrafficLayers(map, () => 'vi');
    traffic.markers.addTo(map);
    traffic.drawIncidents(toTrafficMapLayer([incident, { ...incident, id: 'cleared', status: 'cleared' }]));
    expect(traffic.markers.getLayers()).toHaveLength(1);
    expect(traffic.halo.getLayers()).toHaveLength(1);
    expect(container.querySelector('.routetwin-incident-marker')?.textContent).toBe('3');
    const popup = (traffic.markers.getLayers()[0] as L.Marker).getPopup()?.getContent() as HTMLElement;
    expect(popup.querySelector('script')).toBeNull();
    expect(popup.textContent).toContain(incident.title);
  });
  it('toggles incident markers independently of traffic halos', () => {
    const traffic = new TrafficLayers(map, () => 'vi');
    traffic.setVisibility({ incidents: true, traffic: false, terrain: false });
    expect(map.hasLayer(traffic.markers)).toBe(true);
    expect(map.hasLayer(traffic.halo)).toBe(false);
    traffic.setVisibility({ incidents: false, traffic: true, terrain: false });
    expect(map.hasLayer(traffic.markers)).toBe(false);
    expect(map.hasLayer(traffic.halo)).toBe(true);
    expect(map.hasLayer(traffic.routeSections)).toBe(true);
  });
  it('clears hazard sections when the route is removed', () => {
    const traffic = new TrafficLayers(map, () => 'vi');
    traffic.drawRouteSections(routePlan(), toTrafficMapLayer([incident]));
    expect(traffic.routeSections.getLayers().length).toBeGreaterThan(0);
    traffic.drawRouteSections(null, toTrafficMapLayer([incident]));
    expect(traffic.routeSections.getLayers()).toHaveLength(0);
  });
  it('draws a selected route even with no alternatives and hides labels while navigating', () => {
    const layer = new RouteLayer(map, () => 'vi');
    layer.addRoutesTo(map);
    layer.addLabelsTo(map);
    layer.draw(routePlan(), [], false, false);
    expect(container.querySelectorAll('.routetwin-route-marker')).toHaveLength(2);
    expect(container.querySelectorAll('.routetwin-route-label')).toHaveLength(1);
    layer.clear();
    layer.draw(routePlan(), [], true, false);
    expect(container.querySelectorAll('.routetwin-route-marker')).toHaveLength(1);
    expect(container.querySelector('.routetwin-route-label')).toBeNull();
    layer.destroy();
  });
  it('redraws translated labels and removes the responsive listener on destroy', () => {
    let language: 'vi' | 'en' = 'vi';
    const layer = new RouteLayer(map, () => language);
    layer.addLabelsTo(map);
    layer.draw(routePlan(), [], false, false);
    expect(container.querySelector('.routetwin-route-label')?.textContent).toContain('phút');
    language = 'en';
    layer.redrawLabels();
    expect(container.querySelector('.routetwin-route-label')?.textContent).toContain('min');
    layer.destroy();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
  it('uses compact route labels on mobile', () => {
    media.matches = true;
    const layer = new RouteLayer(map, () => 'vi');
    layer.addLabelsTo(map);
    layer.draw(routePlan(), [], false, false);
    expect(container.querySelector('.routetwin-route-label')?.classList.contains('is-compact')).toBe(true);
    layer.destroy();
  });
  it('switches the dark tile theme and terrain without duplicating layers', () => {
    const base = new BaseLayers(map);
    base.apply('dark', true);
    expect(container.classList.contains('map-theme-dark')).toBe(true);
    let count = 0;
    map.eachLayer(() => count++);
    base.apply('dark', true);
    let again = 0;
    map.eachLayer(() => again++);
    expect(again).toBe(count);
    base.apply('satellite', false);
    expect(container.classList.contains('map-theme-dark')).toBe(false);
  });
  it('fits the route in the unoccluded desktop viewport and refits with new insets', () => {
    const camera = new MapCamera(map);
    camera.setFitInsets({ left: 400, bottom: 0 });
    camera.fit(routePlan().legs[0]!.points);
    expect(map.getBounds().contains([10, 106])).toBe(true);
    expect(map.getBounds().contains([10.01, 106.01])).toBe(true);
    expect(map.getZoom()).toBeGreaterThan(5);
    camera.setFitInsets(null);
    camera.refit();
    expect(map.getZoom()).toBeLessThanOrEqual(15);
  });
  it('reports gestures once and unregisters all listeners', () => {
    const camera = new MapCamera(map),
      gesture = vi.fn();
    const stop = camera.onUserGesture(gesture);
    container.dispatchEvent(new WheelEvent('wheel'));
    map.fire('dragstart');
    expect(gesture).toHaveBeenCalledTimes(2);
    stop();
    container.dispatchEvent(new WheelEvent('wheel'));
    map.fire('dragstart');
    expect(gesture).toHaveBeenCalledTimes(2);
  });
});

it('ignores an orphaned Canvas redraw after disposal', () => {
  const renderer = new LifecycleCanvas();
  renderer.dispose();
  expect(() => renderer._redraw()).not.toThrow();
});
