import type { PoiResult } from '@routetwin/shared';
import { haversineMeters } from '../../../../shared/geo/haversine.js';
import { normalizeText } from '../../domain/poi-geometry.js';

/** Gộp các điểm cùng tên cách nhau < 30 m (giữ điểm đứng trước; đầu vào đã xếp theo độ ưu tiên). */
export function dedupeByCoordinates(results: PoiResult[]): PoiResult[] {
  const kept: PoiResult[] = [];
  for (const item of results) {
    const name = normalizeText(item.name);
    if (!kept.some((other) => normalizeText(other.name) === name && haversineMeters(item, other) < 30))
      kept.push(item);
  }
  return kept;
}
