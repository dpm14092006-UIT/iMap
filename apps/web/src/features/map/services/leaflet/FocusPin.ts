import * as L from 'leaflet';
import type { Place } from '../../../places/types';
import { textElement } from './drawing';

/** Ghim giọt nước cho địa điểm đang xem chi tiết; chỉ vẽ lại khi đổi địa điểm. */
export class FocusPin {
  private marker: L.Marker | null = null;
  private lastKey = '';

  constructor(private readonly map: L.Map) {}

  show(place: Place | null) {
    const key = place ? `${place.id}:${place.lat},${place.lng}:${place.name}` : '';
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.marker?.remove();
    this.marker = null;
    if (!place) return;
    const icon = L.divIcon({
      className: 'routetwin-focus-marker',
      html: '<span></span>',
      iconSize: [30, 40],
      iconAnchor: [15, 38],
    });
    this.marker = L.marker([place.lat, place.lng], { icon, keyboard: false, zIndexOffset: 900 })
      .bindTooltip(textElement('span', place.name), {
        direction: 'top',
        offset: [0, -34],
        className: 'routetwin-tooltip',
      })
      .addTo(this.map);
  }
}
