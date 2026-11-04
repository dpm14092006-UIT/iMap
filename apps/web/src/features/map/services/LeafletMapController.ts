import * as L from 'leaflet';
import type { DemoPlace, MapIncident, MapLayer, RoutePlan } from '../types';

const center: L.LatLngExpression = [10.783, 106.704];

export type MapControllerHandlers = {
  onSelectPlace: (place: DemoPlace) => void;
  onMapClick: (point: { lat: number; lng: number }) => void;
};

export type MapControllerData = {
  layer: MapLayer;
  places: DemoPlace[];
  selectedPlaceId: string | null;
  route: RoutePlan | null;
  incidents: MapIncident[];
  currentLocation: { lat: number; lng: number } | null;
};

/** OOP boundary for the third-party Leaflet map and its lifecycle. */
export class LeafletMapController {
  readonly map: L.Map;
  private readonly streets: L.TileLayer;
  private readonly imagery: L.TileLayer;
  private readonly placesLayer = L.layerGroup();
  private readonly routeLayer = L.layerGroup();
  private readonly incidentsLayer = L.layerGroup();
  private readonly locationLayer = L.layerGroup();
  private lastRouteId: string | null = null;
  private activeLayer: MapLayer = 'street';

  constructor(container: HTMLElement, private readonly handlers: MapControllerHandlers) {
    this.map = L.map(container, { zoomControl: false, preferCanvas: true, attributionControl: true }).setView(center, 13);
    this.map.attributionControl.setPosition('bottomleft');
    this.streets = L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>',
    });
    this.imagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Imagery © Esri, Vantor, Earthstar Geographics, and the GIS User Community',
    });
    this.streets.addTo(this.map);
    this.placesLayer.addTo(this.map);
    this.routeLayer.addTo(this.map);
    this.incidentsLayer.addTo(this.map);
    this.locationLayer.addTo(this.map);
    this.map.on('click', (event: L.LeafletMouseEvent) => handlers.onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng }));
  }

  update(data: MapControllerData) {
    this.setLayer(data.layer);
    this.placesLayer.clearLayers();
    for (const place of data.places) this.drawPlace(place, place.id === data.selectedPlaceId);
    this.drawRoute(data.route);
    this.drawIncidents(data.incidents);
    this.drawCurrentLocation(data.currentLocation);
    if (data.route && data.route.id !== this.lastRouteId) {
      const coordinates = data.route.legs.flatMap((leg) => leg.points);
      if (coordinates.length) this.fit(coordinates);
    }
    this.lastRouteId = data.route?.id ?? null;
  }

  setLayer(layer: MapLayer) {
    const expectedLayerIsVisible = layer === 'satellite' ? this.map.hasLayer(this.imagery) : this.map.hasLayer(this.streets);
    if (this.activeLayer === layer && expectedLayerIsVisible) {
      this.map.getContainer().classList.toggle('map-theme-dark', layer === 'dark');
      return;
    }
    this.activeLayer = layer;
    if (layer === 'satellite') {
      this.map.getContainer().classList.remove('map-theme-dark');
      this.map.removeLayer(this.streets);
      this.imagery.addTo(this.map);
    } else {
      this.map.removeLayer(this.imagery);
      this.streets.addTo(this.map);
      this.map.getContainer().classList.toggle('map-theme-dark', layer === 'dark');
    }
  }

  zoomIn() { this.map.zoomIn(); }
  zoomOut() { this.map.zoomOut(); }
  flyTo(point: { lat: number; lng: number }, zoom = 15) { this.map.flyTo([point.lat, point.lng], zoom, { duration: 0.55 }); }
  getCenter() { const point = this.map.getCenter(); return { lat: point.lat, lng: point.lng }; }
  invalidateSize() { this.map.invalidateSize({ pan: false }); }

  destroy() {
    this.map.remove();
  }

  private drawPlace(place: DemoPlace, selected: boolean) {
    const marker = L.circleMarker([place.lat, place.lng], {
      radius: selected ? 8 : 5,
      color: '#ffffff',
      weight: selected ? 3 : 2,
      fillColor: selected ? '#2476ea' : '#547f68',
      fillOpacity: 1,
      bubblingMouseEvents: false,
    }).addTo(this.placesLayer);
    const tooltip = document.createElement('span');
    tooltip.textContent = place.name;
    marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -5], className: 'routetwin-tooltip' });
    marker.on('click', () => this.handlers.onSelectPlace(place));
  }

  private drawRoute(route: RoutePlan | null) {
    this.routeLayer.clearLayers();
    if (!route) return;
    for (const leg of route.legs) {
      const points = leg.points.map(([lat, lng]) => L.latLng(lat, lng));
      if (points.length > 1) {
        L.polyline(points, { color: '#fff', weight: 10, opacity: 0.94, lineCap: 'round', lineJoin: 'round' }).addTo(this.routeLayer);
        L.polyline(points, { color: route.kind === 'multi' ? '#167dcb' : '#2476ea', weight: 5.5, opacity: 0.98, lineCap: 'round', lineJoin: 'round' }).addTo(this.routeLayer);
      }
    }
    route.stops.forEach((place, index) => {
      const label = index === 0 ? 'A' : route.kind === 'route' ? 'B' : String(index);
      const marker = L.marker([place.lat, place.lng], { icon: this.routeMarker(label, label === 'B'), keyboard: false }).addTo(this.routeLayer);
      const tooltip = document.createElement('span');
      tooltip.textContent = place.name;
      marker.bindTooltip(tooltip, { direction: 'top', className: 'routetwin-tooltip' });
    });
  }

  private drawIncidents(incidents: MapIncident[]) {
    this.incidentsLayer.clearLayers();
    incidents.forEach((incident) => {
      const marker = L.marker([incident.lat, incident.lng], { icon: this.incidentMarker(incident.severity), keyboard: false }).addTo(this.incidentsLayer);
      const content = document.createElement('div');
      const heading = document.createElement('strong');
      heading.textContent = incident.description;
      const detail = document.createElement('p');
      detail.textContent = 'Cảnh báo cộng đồng · chưa xác minh';
      detail.className = 'mb-0 mt-1 text-xs text-slate-500';
      content.append(heading, detail);
      marker.bindPopup(content);
    });
  }

  private drawCurrentLocation(point: { lat: number; lng: number } | null) {
    this.locationLayer.clearLayers();
    if (!point) return;
    L.circleMarker([point.lat, point.lng], { radius: 8, fillColor: '#2476ea', fillOpacity: 1, color: '#fff', weight: 3 }).addTo(this.locationLayer);
  }

  private fit(points: L.LatLngExpression[]) {
    this.map.fitBounds(L.latLngBounds(points).pad(0.18), { padding: [70, 70], maxZoom: 15 });
  }

  private routeMarker(label: string, isEnd: boolean) {
    const color = isEnd ? '#2476ea' : '#20a26b';
    return L.divIcon({
      className: 'routetwin-route-marker',
      html: `<span style="--marker-color:${color}">${label}</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }

  private incidentMarker(severity: MapIncident['severity']) {
    const tone = severity === 'high' ? 'high' : severity === 'low' ? 'low' : 'medium';
    return L.divIcon({ className: `routetwin-incident-marker ${tone}`, html: '<span>!</span>', iconSize: [28, 28], iconAnchor: [14, 14] });
  }
}
