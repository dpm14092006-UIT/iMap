import * as L from 'leaflet';
import type { LatLng } from '../../../../shared/geo/types';

/** Vị trí hiện tại: chấm tròn khi xem bản đồ, mũi tên xoay theo hướng đi khi dẫn đường. */
export class LocationLayer {
  readonly group = L.layerGroup();
  private marker: L.Marker | L.CircleMarker | null = null;
  private mode: 'passive' | 'navigation' | null = null;

  update(point: LatLng | null, isNavigating: boolean, headingDegrees: number | null) {
    if (!point) {
      this.group.clearLayers();
      this.marker = null;
      this.mode = null;
      return;
    }

    const mode = isNavigating ? 'navigation' : 'passive';
    if (!this.marker || this.mode !== mode) {
      this.group.clearLayers();
      this.marker =
        mode === 'navigation'
          ? L.marker([point.lat, point.lng], {
              icon: navigationIcon(),
              keyboard: false,
              interactive: false,
              zIndexOffset: 1000,
            }).addTo(this.group)
          : L.circleMarker([point.lat, point.lng], {
              radius: 8,
              fillColor: '#004779',
              fillOpacity: 1,
              color: '#fff',
              weight: 3,
            }).addTo(this.group);
      this.mode = mode;
    }

    this.marker.setLatLng([point.lat, point.lng]);
    if (mode === 'navigation') {
      const element = this.marker.getElement();
      if (element instanceof HTMLElement || element instanceof SVGElement) {
        element.style.setProperty('--heading-degrees', `${headingDegrees ?? 0}deg`);
      }
    }
  }
}

function navigationIcon() {
  return L.divIcon({
    className: 'routetwin-navigation-marker',
    html: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3 43 43 24 34 5 43Z" /></svg>',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}
