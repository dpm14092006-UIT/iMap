/**
 * Tải dữ liệu đường OpenStreetMap của một vùng nhỏ qua Overpass API và lưu thành JSON gọn
 * để backend dựng đồ thị cho Dijkstra/A*.
 *
 * Cách chạy (từ thư mục gốc):
 *   npm run osm:import
 *   npm run osm:import -- --bbox=10.765,106.685,10.800,106.725 --out=apps/api/data/osm/hcmc-center.json
 *
 * bbox theo thứ tự: south,west,north,east. Dữ liệu OSM theo giấy phép ODbL, cần ghi nguồn.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  allowedVehicles,
  RELEVANT_TAGS,
} from '../../apps/api/src/modules/navigation/infrastructure/osm/osmRoadRules.js';
import type {
  BoundingBox,
  OsmExtract,
  OsmTags,
  OsmWay,
} from '../../apps/api/src/modules/navigation/infrastructure/osm/osmTypes.js';

/** Vùng mặc định: trung tâm TP.HCM (Quận 1, một phần Quận 3, Bình Thạnh, có Landmark 81). */
const DEFAULT_BBOX: BoundingBox = { south: 10.765, west: 106.685, north: 10.8, east: 106.725 };
const DEFAULT_OUTPUT = 'apps/api/data/osm/hcmc-center.json';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
/** Loại đường có thể dùng cho ô tô/xe máy (lọc chi tiết hơn bằng osmRoadRules). */
const HIGHWAY_FILTER =
  '^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|footway|path|pedestrian|track)$';

type OverpassElement =
  | { type: 'node'; id: number; lat: number; lon: number }
  | { type: 'way'; id: number; nodes: number[]; tags?: OsmTags };

/** Đọc tham số dạng --key=value từ dòng lệnh. */
function readArgs(): { bbox: BoundingBox; output: string } {
  const args = new Map(
    process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=') as [string, string]),
  );
  const bboxArg = args.get('bbox');
  let bbox = DEFAULT_BBOX;
  if (bboxArg) {
    const [south, west, north, east] = bboxArg.split(',').map(Number);
    if ([south, west, north, east].some((value) => value === undefined || !Number.isFinite(value)))
      throw new Error('bbox phải có dạng south,west,north,east');
    bbox = { south: south!, west: west!, north: north!, east: east! };
  }
  return { bbox, output: resolve(args.get('out') ?? DEFAULT_OUTPUT) };
}

/** Chỉ giữ các tag mà backend dùng tới. */
function pickTags(tags: OsmTags): OsmTags {
  return Object.fromEntries(
    RELEVANT_TAGS.filter((key) => tags[key] !== undefined).map((key) => [key, tags[key]!]),
  );
}

/** Làm tròn 7 chữ số thập phân (~1 cm) để file nhỏ hơn. */
const round = (value: number) => Math.round(value * 1e7) / 1e7;

async function main() {
  const { bbox, output } = readArgs();
  const area = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  // Lấy các way đường trong vùng, kèm toàn bộ node của chúng ("(._;>;)").
  const query = `[out:json][timeout:120];way["highway"~"${HIGHWAY_FILTER}"](${area});(._;>;);out body;`;

  console.log(`Đang tải OSM cho vùng ${area} ...`);
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'routetwin-student-project/0.1',
    },
    body: new URLSearchParams({ data: query }),
  });
  if (!response.ok) throw new Error(`Overpass trả lỗi HTTP ${response.status}. Thử lại sau ít phút.`);
  const { elements } = (await response.json()) as { elements: OverpassElement[] };

  // 1. Giữ way mà ít nhất một loại xe đi được.
  const ways: OsmWay[] = elements
    .filter((element): element is Extract<OverpassElement, { type: 'way' }> => element.type === 'way')
    .map((way) => ({ id: way.id, nodes: way.nodes, tags: pickTags(way.tags ?? {}) }))
    .filter((way) => allowedVehicles(way.tags).length > 0);

  // 2. Giữ node thuộc các way đó.
  const usedNodes = new Set(ways.flatMap((way) => way.nodes));
  const nodes: OsmExtract['nodes'] = {};
  for (const element of elements) {
    if (element.type === 'node' && usedNodes.has(element.id))
      nodes[element.id] = [round(element.lat), round(element.lon)];
  }

  const extract: OsmExtract = {
    meta: {
      source: 'OpenStreetMap via Overpass API',
      license: 'ODbL 1.0',
      bbox,
      fetchedAt: new Date().toISOString(),
    },
    nodes,
    ways,
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(extract));
  console.log(`Đã lưu ${ways.length} way, ${Object.keys(nodes).length} node -> ${output}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
