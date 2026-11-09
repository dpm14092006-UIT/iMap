import { describe, expect, it } from 'vitest';
import { OsmGraphBuilder } from './OsmGraphBuilder.js';
import { allowedVehicles, speedKmh, travelDirection } from './osmRoadRules.js';
import type { OsmExtract, OsmTags } from './osmTypes.js';

describe('osmRoadRules', () => {
  it('xe máy không được vào cao tốc, ô tô thì được', () => {
    expect(allowedVehicles({ highway: 'motorway' })).toEqual(['car']);
    expect(allowedVehicles({ highway: 'primary' })).toEqual(['car', 'motorcycle']);
  });

  it('hẻm (footway) chỉ cho xe máy khi có tag motorcycle=yes', () => {
    expect(allowedVehicles({ highway: 'footway' })).toEqual([]);
    expect(allowedVehicles({ highway: 'footway', motorcycle: 'yes' })).toEqual(['motorcycle']);
    expect(allowedVehicles({ highway: 'footway', access: 'yes' })).toEqual([]); // access chung không tính cho đường đi bộ
  });

  it('tag cụ thể ưu tiên hơn tag chung', () => {
    expect(allowedVehicles({ highway: 'residential', access: 'no', motorcycle: 'yes' })).toEqual(['motorcycle']);
    expect(allowedVehicles({ highway: 'residential', motorcar: 'no' })).toEqual(['motorcycle']);
  });

  it('đọc đường một chiều, kể cả ngoại lệ cho xe máy', () => {
    const tags: OsmTags = { highway: 'secondary', oneway: 'yes', 'oneway:motorcycle': 'no' };
    expect(travelDirection(tags, 'car')).toBe('forward');
    expect(travelDirection(tags, 'motorcycle')).toBe('both');
    expect(travelDirection({ highway: 'primary', oneway: '-1' }, 'car')).toBe('backward');
    expect(travelDirection({ highway: 'primary', junction: 'roundabout' }, 'car')).toBe('forward');
  });

  it('ưu tiên tag maxspeed, nếu không có thì theo loại đường', () => {
    expect(speedKmh({ highway: 'primary', maxspeed: '60' })).toBe(60);
    expect(speedKmh({ highway: 'primary', maxspeed: '30 mph' })).toBeCloseTo(48.27);
    expect(speedKmh({ highway: 'residential' })).toBe(25);
  });
});

describe('OsmGraphBuilder', () => {
  /** 3 node thẳng hàng: 1 — 2 — 3. Way 10 hai chiều (1→2), way 11 một chiều (2→3). */
  const extract: OsmExtract = {
    meta: { source: 'test', license: 'ODbL', bbox: { south: 10, west: 106, north: 11, east: 107 }, fetchedAt: '' },
    nodes: { 1: [10.77, 106.69], 2: [10.771, 106.69], 3: [10.772, 106.69] },
    ways: [
      { id: 10, nodes: [1, 2], tags: { highway: 'residential', name: 'Hẻm A' } },
      { id: 11, nodes: [2, 3], tags: { highway: 'tertiary', oneway: 'yes' } },
    ],
  };

  it('đường hai chiều tạo 2 cạnh, đường một chiều tạo 1 cạnh', () => {
    const graph = new OsmGraphBuilder().build(extract);
    expect(graph.nodeCount).toBe(3);
    expect(graph.edgeCount).toBe(3);
    expect(graph.neighbors('2', 'car').map((edge) => edge.to).sort()).toEqual(['1', '3']);
    expect(graph.neighbors('3', 'car')).toEqual([]);
  });

  it('độ dài cạnh tính từ tọa độ (0.001 độ vĩ ≈ 111 m)', () => {
    const [edge] = new OsmGraphBuilder().build(extract).neighbors('1', 'car');
    expect(edge?.distanceMeters).toBeCloseTo(111.2, 0);
    expect(edge?.name).toBe('Hẻm A');
  });
});
