import type { LatLng } from '../../../../shared/geo/types';
import { iconSvg } from '../../../../shared/ui/Icon';
import { poiMetaFor } from '../../../explore/domain/poiCatalog';
import type { Poi } from '../../../explore/types';
import type { Place } from '../../../places/types';
import { maplibregl, withTooltip, type GLMap } from './gl';

/** Phần tử marker: nhấn vào không lan xuống bản đồ (không kích hoạt chọn điểm trên bản đồ). */
export function markerElement(className: string, html = ''): HTMLDivElement {
  const element = document.createElement('div');
  element.className = className;
  element.innerHTML = html;
  return element;
}

/** Marker POI theo danh mục; chỉ vẽ lại khi danh sách đổi, còn làm nổi bật thì chỉ đổi class. */
export class PoiMarkers {
  private readonly markers = new Map<string, maplibregl.Marker>();
  private lastPois: Poi[] | null = null;

  constructor(
    private readonly map: GLMap,
    private readonly onPoiClick?: (poiId: string) => void,
  ) {}

  update(pois: Poi[], highlightedId: string | null) {
    if (pois !== this.lastPois) {
      this.lastPois = pois;
      this.clear();
      for (const poi of pois) {
        const meta = poiMetaFor(poi.category);
        const element = withTooltip(
          markerElement(
            'routetwin-poi-marker',
            `<span style="--marker-color:${meta.color}">${iconSvg(meta.icon, 16)}</span>`,
          ),
          poi.name,
        );
        element.addEventListener('click', (event) => {
          event.stopPropagation();
          this.onPoiClick?.(poi.id);
        });
        const marker = new maplibregl.Marker({ element, anchor: 'bottom', offset: [0, 4] })
          .setLngLat([poi.lng, poi.lat])
          .addTo(this.map);
        this.markers.set(poi.id, marker);
      }
    }
    for (const [id, marker] of this.markers)
      marker.getElement().classList.toggle('is-highlighted', id === highlightedId);
  }

  clear() {
    for (const marker of this.markers.values()) marker.remove();
    this.markers.clear();
  }
}

/** Ghim giọt nước cho địa điểm đang xem chi tiết; chỉ vẽ lại khi đổi địa điểm. */
export class FocusPin {
  private marker: maplibregl.Marker | null = null;
  private lastKey = '';

  constructor(private readonly map: GLMap) {}

  show(place: Place | null) {
    const key = place ? `${place.id}:${place.lat},${place.lng}:${place.name}` : '';
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.marker?.remove();
    this.marker = null;
    if (!place) return;
    const element = withTooltip(markerElement('routetwin-focus-marker', '<span></span>'), place.name);
    this.marker = new maplibregl.Marker({ element, anchor: 'bottom', offset: [0, 2] })
      .setLngLat([place.lng, place.lat])
      .addTo(this.map);
  }

  destroy() {
    this.marker?.remove();
  }
}

/** Vị trí hiện tại: chấm tròn khi xem bản đồ, mũi tên xoay theo hướng đi khi dẫn đường. */
export class LocationMarker {
  private marker: maplibregl.Marker | null = null;
  private mode: 'passive' | 'navigation' | null = null;

  constructor(private readonly map: GLMap) {}

  update(point: LatLng | null, isNavigating: boolean, headingDegrees: number | null) {
    if (!point) {
      this.destroy();
      return;
    }
    const mode = isNavigating ? 'navigation' : 'passive';
    if (!this.marker || this.mode !== mode) {
      this.marker?.remove();
      const element =
        mode === 'navigation'
          ? markerElement(
              'routetwin-navigation-marker',
              '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3 43 43 24 34 5 43Z" /></svg>',
            )
          : markerElement('routetwin-location-dot');
      element.style.pointerEvents = 'none';
      // Mũi tên nằm trên mặt đất khi bản đồ nghiêng (3D) để hướng đi khớp với đường.
      this.marker = new maplibregl.Marker({
        element,
        anchor: 'center',
        rotationAlignment: mode === 'navigation' ? 'map' : 'viewport',
        pitchAlignment: mode === 'navigation' ? 'map' : 'viewport',
      })
        .setLngLat([point.lng, point.lat])
        .addTo(this.map);
      this.mode = mode;
    }
    this.marker.setLngLat([point.lng, point.lat]);
    if (mode === 'navigation')
      this.marker.getElement().style.setProperty('--heading-degrees', `${headingDegrees ?? 0}deg`);
  }

  destroy() {
    this.marker?.remove();
    this.marker = null;
    this.mode = null;
  }
}
