// @vitest-environment jsdom
import * as L from 'leaflet';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VIETNAM_ARCHIPELAGOS, VIETNAM_ISLANDS } from '../../domain/vietnamArchipelagos';
import { ArchipelagoLabels } from './ArchipelagoLabels';

let map: L.Map, container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  Object.defineProperties(container, { clientWidth: { value: 1200 }, clientHeight: { value: 800 } });
  map = L.map(container, { zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView(
    [14, 112],
    5,
  );
});
afterEach(() => {
  map.remove();
  container.remove();
});

const text = () => container.querySelector('.leaflet-sovereignty-labels-pane')?.textContent ?? '';

describe('ArchipelagoLabels', () => {
  it('draws the Vietnamese names of Hoàng Sa, Trường Sa and Biển Đông at low zoom', () => {
    const labels = new ArchipelagoLabels(map, 'vi');
    expect(text()).toContain('Quần đảo Hoàng Sa');
    expect(text()).toContain('Quần đảo Trường Sa');
    expect(text().match(/\(Việt Nam\)/g)).toHaveLength(2);
    expect(text()).toContain('Biển Đông');
    expect(text()).not.toContain('Đảo Phú Lâm');
    expect(labels.visibleLabelCount()).toBe(VIETNAM_ARCHIPELAGOS.length + 1);
  });

  it('shows island names when zoomed in and keeps the archipelago names at every zoom', () => {
    const labels = new ArchipelagoLabels(map, 'vi');
    map.setView([10.377, 114.365], 12);
    expect(text()).toContain('Đảo Ba Bình');
    expect(text()).toContain('Quần đảo Trường Sa');
    expect(text()).not.toContain('Biển Đông');
    expect(labels.visibleLabelCount()).toBe(VIETNAM_ARCHIPELAGOS.length + VIETNAM_ISLANDS.length);
  });

  it('switches language and never renders HTML', () => {
    const labels = new ArchipelagoLabels(map, 'vi');
    labels.setLanguage('en');
    expect(text()).toContain('Hoang Sa Archipelago');
    expect(text()).toContain('(Viet Nam)');
    expect(text()).toContain('East Sea');
    expect(text()).not.toContain('Quần đảo');
    expect(
      container.querySelector(
        '.leaflet-sovereignty-labels-pane script, .leaflet-sovereignty-labels-pane img',
      ),
    ).toBeNull();
  });

  it('is not interactive so map clicks pass through', () => {
    new ArchipelagoLabels(map, 'vi');
    const pane = map.getPane('sovereignty-labels')!;
    expect(pane.style.pointerEvents).toBe('none');
    expect(Number(pane.style.zIndex)).toBeLessThan(400);
    expect(pane.querySelector('.leaflet-interactive')).toBeNull();
  });

  it('removes its labels on destroy', () => {
    const labels = new ArchipelagoLabels(map, 'vi');
    labels.destroy();
    expect(text()).toBe('');
    expect(labels.visibleLabelCount()).toBe(0);
  });
});
