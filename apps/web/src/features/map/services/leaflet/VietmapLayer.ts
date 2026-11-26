import type { Map } from 'leaflet';
import { MaplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url&no-inline';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapLayer } from '../../types';

const VIETMAP_RESOURCES = 'https://maps.vietmap.vn/maps/';
type VietmapStyle = Exclude<MapLayer, 'admin'>;
const STYLES: Record<VietmapStyle, string> = { street: 'tm', dark: 'dm', satellite: 'hm' };
const ATTRIBUTION =
  '<a href="https://maps.vietmap.vn/" target="_blank" rel="noopener noreferrer">© Vietmap</a>';

setWorkerUrl(workerUrl);

class VietmapLayer extends MaplibreGL {
  override onRemove(map: Map) {
    if (this.getMaplibreMap()) super.onRemove(map);
    // GL initialization can throw after the plugin inserted its container, for example without WebGL.
    else this.getContainer()?.remove();
    return this;
  }
}

export function addVietmapLayer(map: Map, layer: VietmapStyle, onUnavailable: () => void): VietmapLayer {
  const api = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
  const proxy = new URL(`${api}/map/vietmap/`, window.location.origin);
  const base = new VietmapLayer({
    style: new URL(`styles/${STYLES[layer]}/style.json`, proxy).href,
    attributionControl: { customAttribution: ATTRIBUTION },
    interactive: false,
    transformRequest: (url) =>
      url.startsWith(VIETMAP_RESOURCES) ? { url: proxy.href + url.slice(VIETMAP_RESOURCES.length) } : { url },
  });

  try {
    base.addTo(map);
    const gl = base.getMaplibreMap();
    let loaded = false;
    gl.once('load', () => {
      loaded = true;
    });
    gl.on('error', ({ error }) => {
      const status = 'status' in error ? error.status : undefined;
      const url = 'url' in error ? error.url : undefined;
      if (
        [401, 403, 423, 429, 502, 503].includes(Number(status)) ||
        (!loaded && !(status === 404 && typeof url === 'string' && url.includes('/tiles/')))
      ) {
        queueMicrotask(onUnavailable);
      }
    });
    gl.on('webglcontextlost', () => queueMicrotask(onUnavailable));
  } catch (error) {
    if (map.hasLayer(base)) map.removeLayer(base);
    throw error;
  }
  return base;
}
