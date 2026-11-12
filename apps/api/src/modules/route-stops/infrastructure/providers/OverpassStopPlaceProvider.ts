import { z } from 'zod';
import { stopCategoryLabels, type StopCategory, type StopPlace } from '@routetwin/shared';
import { AppError } from '../../../../shared/errors/AppError.js';
import type { StopBounds, StopPlaceProvider } from '../../application/ports/StopPlaceProvider.js';
const categoryTags: Record<StopCategory, { key: string; value: string }> = {
  fuel: { key: 'amenity', value: 'fuel' },
  cafe: { key: 'amenity', value: 'cafe' },
  restaurant: { key: 'amenity', value: 'restaurant' },
  pharmacy: { key: 'amenity', value: 'pharmacy' },
  atm: { key: 'amenity', value: 'atm' },
  toilets: { key: 'amenity', value: 'toilets' },
  school: { key: 'amenity', value: 'school' },
  hospital: { key: 'amenity', value: 'hospital' },
  parking: { key: 'amenity', value: 'parking' },
  library: { key: 'amenity', value: 'library' },
  park: { key: 'leisure', value: 'park' },
  bus_stop: { key: 'highway', value: 'bus_stop' },
  train_station: { key: 'railway', value: 'station' },
  rest_area: { key: 'highway', value: 'rest_area' },
};
const payloadSchema = z.object({
  remark: z.string().optional(),
  elements: z
    .array(
      z.object({
        type: z.enum(['node', 'way', 'relation']),
        id: z.number().int().positive(),
        lat: z.number().min(-90).max(90).optional(),
        lon: z.number().min(-180).max(180).optional(),
        center: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).optional(),
        tags: z.record(z.string(), z.string()).optional(),
      }),
    )
    .max(120),
});
/** Public OSM instance: bounded queries, timeout, short-lived cache; replace for larger deployments. */
export class OverpassStopPlaceProvider implements StopPlaceProvider {
  private readonly cache = new Map<string, { until: number; places: StopPlace[] }>();
  private readonly pending = new Map<string, Promise<StopPlace[]>>();
  constructor(private readonly endpoint = 'https://overpass-api.de/api/interpreter') {}
  async search(category: StopCategory, bounds: StopBounds): Promise<StopPlace[]> {
    const key = JSON.stringify([category, bounds]);
    const cached = this.cache.get(key);
    if (cached && cached.until > Date.now()) return cached.places;
    const pending = this.pending.get(key);
    if (pending) return pending;
    const request = this.request(category, bounds);
    this.pending.set(key, request);
    try {
      const places = await request;
      if (this.cache.size >= 30) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { until: Date.now() + 120000, places });
      return places;
    } finally {
      this.pending.delete(key);
    }
  }
  private async request(category: StopCategory, bounds: StopBounds): Promise<StopPlace[]> {
    // Category is an enum and bounds are generated from server-side route geometry, never raw QL from a model.
    const bbox = [bounds.south, bounds.west, bounds.north, bounds.east]
      .map((value) => value.toFixed(6))
      .join(',');
    const tag = categoryTags[category];
    const query = `[out:json][timeout:8];nwr["${tag.key}"="${tag.value}"]["access"!~"^(private|no)$"](${bbox});out center tags 120;`;
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Overpass HTTP failure');
      const parsed = payloadSchema.parse(await response.json());
      if (parsed.remark) throw new Error('Overpass returned incomplete results');
      return parsed.elements.flatMap((element) => {
        const lat = element.lat ?? element.center?.lat;
        const lng = element.lon ?? element.center?.lon;
        const tags = element.tags ?? {};
        if (
          lat === undefined ||
          lng === undefined ||
          tags[tag.key] !== tag.value ||
          ['no', 'private'].includes(tags.access ?? '')
        )
          return [];
        return [
          {
            id: `osm-${element.type}-${element.id}`,
            name: tags.name ?? tags.brand ?? `${stopCategoryLabels[category]} (chưa có tên)`,
            address:
              [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], tags['addr:city']]
                .filter(Boolean)
                .join(', ') || 'Chưa có địa chỉ trong OpenStreetMap',
            lat,
            lng,
            category,
            osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
            openingHours: tags.opening_hours ?? null,
          },
        ];
      });
    } catch {
      throw new AppError(
        502,
        'STOP_PLACES_UNAVAILABLE',
        'Chưa lấy được địa điểm từ OpenStreetMap. Vui lòng thử lại sau.',
      );
    }
  }
}
