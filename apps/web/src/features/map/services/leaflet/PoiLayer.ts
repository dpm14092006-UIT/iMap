import * as L from 'leaflet';
import { iconSvg } from '../../../../shared/ui/Icon';
import { poiMetaFor } from '../../../explore/domain/poiCatalog';
import type { Poi } from '../../../explore/types';
import { textElement } from './drawing';

/** Marker POI theo danh mục; chỉ vẽ lại khi danh sách đổi, còn làm nổi bật thì chỉ đổi class. */
export class PoiLayer {
  readonly group = L.layerGroup();
  private readonly markers = new Map<string, L.Marker>();
  private lastPois: Poi[] | null = null;

  constructor(private readonly onPoiClick?: (poiId: string) => void) {}

  update(pois: Poi[], highlightedId: string | null) {
    if (pois !== this.lastPois) {
      this.lastPois = pois;
      this.group.clearLayers();
      this.markers.clear();
      for (const poi of pois) {
        const meta = poiMetaFor(poi.category);
        const marker = L.marker([poi.lat, poi.lng], {
          icon: L.divIcon({
            className: 'routetwin-poi-marker',
            html: `<span style="--marker-color:${meta.color}">${iconSvg(meta.icon, 16)}</span>`,
            iconSize: [32, 32],
            iconAnchor: [16, 36],
          }),
          keyboard: false,
        });
        marker.bindTooltip(textElement('span', poi.name), {
          direction: 'top',
          offset: [0, -30],
          className: 'routetwin-tooltip',
        });
        marker.on('click', (event) => {
          L.DomEvent.stopPropagation(event);
          this.onPoiClick?.(poi.id);
        });
        marker.addTo(this.group);
        this.markers.set(poi.id, marker);
      }
    }
    for (const [id, marker] of this.markers) {
      marker.getElement()?.classList.toggle('is-highlighted', id === highlightedId);
    }
  }
}
