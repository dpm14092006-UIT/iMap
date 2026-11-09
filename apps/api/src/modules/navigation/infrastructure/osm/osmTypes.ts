/** Tag của một way OSM, ví dụ { highway: 'primary', oneway: 'yes', name: 'Lê Lợi' }. */
export type OsmTags = Record<string, string>;

export type OsmWay = { id: number; nodes: number[]; tags: OsmTags };

export type BoundingBox = { south: number; west: number; north: number; east: number };

/**
 * File dữ liệu OSM đã lọc, do script `npm run osm:import` tạo ra.
 * Chỉ giữ way là đường xe đi được và các node thuộc những way đó.
 */
export type OsmExtract = {
  meta: {
    source: string;
    license: string;
    bbox: BoundingBox;
    fetchedAt: string;
  };
  /** id node -> [lat, lng] */
  nodes: Record<string, [number, number]>;
  ways: OsmWay[];
};
