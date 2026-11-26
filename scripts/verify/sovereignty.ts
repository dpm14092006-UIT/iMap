#!/usr/bin/env tsx
/**
 * Vietnam Sovereignty Validation — cổng kiểm chứng BẮT BUỘC trước khi phát hành bản đồ iMap.
 *
 *   npm run verify:sovereignty                       # kiểm tra tĩnh + hình ảnh (ô bản đồ giả lập, không tốn lượt API)
 *   npm run verify:sovereignty -- --live             # thêm kiểm tra dữ liệu thật qua API (cần API chạy ở cổng 4000)
 *   npm run verify:sovereignty -- --update-baseline  # ghi lại ảnh chuẩn sau khi đã duyệt bằng mắt
 *   npm run verify:sovereignty -- --only=names,license --api=http://127.0.0.1:4000/api
 *
 * 5 cổng: Geographic Coverage · Boundary Validation · Place Name Validation · License Validation ·
 * Visual Regression Testing. Cổng nào FAIL thì mã thoát = 1 (chặn merge/deploy). WARN chỉ báo, không chặn.
 *
 * Chế độ --live gọi Vietmap qua proxy của API (khoảng 60 ô vector/lần chạy, nằm trong hạn mức miễn phí)
 * và VNSDI (cần VNSDI_BASEMAP_TOKEN ở apps/api/.env).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { VIETMAP_COVERAGE } from '../../packages/shared/src/constants';
import {
  EAST_SEA,
  ISLAND_LABEL_MIN_ZOOM,
  SOVEREIGN_NAME,
  VIETNAM_ARCHIPELAGOS,
  VIETNAM_ISLANDS,
} from '../../apps/web/src/features/map/domain/vietnamArchipelagos';
import {
  needsTerritoryInset,
  VIETNAM_TERRITORY_EXTENT,
} from '../../apps/web/src/features/map/domain/vietnamTerritory';
import {
  BASEMAP_PROVIDERS,
  MODE_CHAINS,
  usableChain,
  type BasemapMode,
} from '../../apps/web/src/features/map/basemap/providers';
import { MAP_TILE_SOURCES } from '../../apps/web/src/shared/security/contentSecurityPolicy';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key!, value];
  }),
);
const LIVE = args.live === 'true';
const UPDATE_BASELINE = args['update-baseline'] === 'true';
const API = (args.api ?? 'http://127.0.0.1:4000/api').replace(/\/+$/, '');
const GATES = ['coverage', 'boundary', 'names', 'license', 'visual'] as const;
type GateId = (typeof GATES)[number];
const only = args.only ? new Set(args.only.split(',')) : null;
const unknown = only && [...only].find((id) => !GATES.includes(id as GateId));
if (unknown) {
  console.error(`Cổng không tồn tại: ${unknown}. Dùng: ${GATES.join(', ')}`);
  process.exit(2);
}
const REPORT_DIR = resolve(root, args.out ?? 'reports/sovereignty');
const BASELINE_DIR = resolve(root, 'scripts/verify/baselines/sovereignty');

// ---------------------------------------------------------------------------------------------
// Kết quả
// ---------------------------------------------------------------------------------------------
type Status = 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
type Check = { status: Status; message: string };
class Gate {
  readonly checks: Check[] = [];
  constructor(
    readonly id: GateId,
    readonly title: string,
  ) {}
  pass(message: string) {
    this.checks.push({ status: 'PASS', message });
  }
  fail(message: string) {
    this.checks.push({ status: 'FAIL', message });
  }
  warn(message: string) {
    this.checks.push({ status: 'WARN', message });
  }
  skip(message: string) {
    this.checks.push({ status: 'SKIP', message });
  }
  expect(ok: boolean, passMessage: string, failMessage = passMessage) {
    if (ok) this.pass(passMessage);
    else this.fail(failMessage);
  }
  get status(): Status {
    if (this.checks.some((c) => c.status === 'FAIL')) return 'FAIL';
    if (this.checks.length === 0 || this.checks.every((c) => c.status === 'SKIP')) return 'SKIP';
    if (this.checks.some((c) => c.status === 'WARN')) return 'WARN';
    return 'PASS';
  }
}

// ---------------------------------------------------------------------------------------------
// Dữ liệu chuẩn
// ---------------------------------------------------------------------------------------------
type RefPoint = { name: string; lat: number; lng: number; kind: 'mainland' | 'island' | 'archipelago' };
/** Điểm cực, đảo tiền tiêu và hai quần đảo: bản đồ phải hiển thị đủ. */
const REFERENCE_POINTS: RefPoint[] = [
  { name: 'Lũng Cú (cực Bắc)', lat: 23.392, lng: 105.316, kind: 'mainland' },
  { name: 'A Pa Chải (cực Tây)', lat: 22.401, lng: 102.144, kind: 'mainland' },
  { name: 'Mũi Đôi (cực Đông đất liền)', lat: 12.649, lng: 109.464, kind: 'mainland' },
  { name: 'Đất Mũi Cà Mau (cực Nam đất liền)', lat: 8.6, lng: 104.723, kind: 'mainland' },
  { name: 'Hà Nội', lat: 21.028, lng: 105.854, kind: 'mainland' },
  { name: 'Đà Nẵng', lat: 16.054, lng: 108.202, kind: 'mainland' },
  { name: 'TP. Hồ Chí Minh', lat: 10.776, lng: 106.7, kind: 'mainland' },
  { name: 'Đảo Bạch Long Vĩ', lat: 20.133, lng: 107.722, kind: 'island' },
  { name: 'Đảo Cồn Cỏ', lat: 17.16, lng: 107.34, kind: 'island' },
  { name: 'Đảo Lý Sơn', lat: 15.38, lng: 109.12, kind: 'island' },
  { name: 'Đảo Phú Quý', lat: 10.52, lng: 108.94, kind: 'island' },
  { name: 'Côn Đảo', lat: 8.683, lng: 106.608, kind: 'island' },
  { name: 'Đảo Phú Quốc', lat: 10.227, lng: 103.964, kind: 'island' },
  { name: 'Đảo Thổ Chu', lat: 9.29, lng: 103.48, kind: 'island' },
  ...VIETNAM_ARCHIPELAGOS.map((a) => ({
    name: a.name.vi,
    lat: a.label[0],
    lng: a.label[1],
    kind: 'archipelago' as const,
  })),
  ...VIETNAM_ISLANDS.map((i) => ({ name: i.name.vi, lat: i.lat, lng: i.lng, kind: 'island' as const })),
];

/** Tên/thuật ngữ không được xuất hiện ở bất cứ đâu trong UI hoặc dữ liệu nền (tên do nước khác đặt). */
const FORBIDDEN_NAMES: { term: string; why: string }[] = [
  { term: 'South China Sea', why: 'phải là "Biển Đông" / "East Sea"' },
  { term: 'Biển Nam Trung Hoa', why: 'phải là "Biển Đông"' },
  { term: 'Nam Trung Hoa', why: 'phải là "Biển Đông"' },
  { term: 'Paracel', why: 'phải là "Hoàng Sa" / "Hoang Sa"' },
  { term: 'Spratly', why: 'phải là "Trường Sa" / "Truong Sa"' },
  { term: 'Xisha', why: 'phải là "Hoàng Sa"' },
  { term: 'Nansha', why: 'phải là "Trường Sa"' },
  { term: 'Zhongsha', why: 'tên nước ngoài đặt cho khu vực Biển Đông' },
  { term: 'Sansha', why: 'đơn vị hành chính nước ngoài đặt trái phép trên Hoàng Sa/Trường Sa' },
  { term: 'Tam Sa', why: 'đơn vị hành chính nước ngoài đặt trái phép trên Hoàng Sa/Trường Sa' },
  { term: 'Tây Sa', why: 'phải là "Hoàng Sa"' },
  { term: 'Nam Sa', why: 'phải là "Trường Sa"' },
  { term: 'Yongxing', why: 'phải là "Đảo Phú Lâm"' },
  { term: 'Woody Island', why: 'phải là "Đảo Phú Lâm"' },
  { term: 'Itu Aba', why: 'phải là "Đảo Ba Bình"' },
  { term: 'Taiping Island', why: 'phải là "Đảo Ba Bình"' },
  { term: 'nine-dash', why: 'đường lưỡi bò không được thể hiện' },
  { term: 'nine dash', why: 'đường lưỡi bò không được thể hiện' },
  { term: '九段线', why: 'đường lưỡi bò không được thể hiện' },
  { term: '西沙', why: 'phải là "Hoàng Sa"' },
  { term: '南沙', why: 'phải là "Trường Sa"' },
  { term: '中沙', why: 'tên nước ngoài đặt cho khu vực Biển Đông' },
  { term: '三沙', why: 'đơn vị hành chính đặt trái phép' },
  { term: '南海', why: 'phải là "Biển Đông"' },
  { term: '永兴', why: 'phải là "Đảo Phú Lâm"' },
];
/** Địa danh Việt Nam hợp lệ có chứa "Sa" (Sa Huỳnh, Sa Pa, Sa Đéc, Sa Thầy…): không coi là tên sai. */
const VIETNAMESE_SA_PLACES = ['Huỳnh', 'Pa', 'Đéc', 'Thầy', 'Thày', 'Vĩ', 'Kỳ', 'Ra', 'Lung', 'Nhất'];
const forbiddenPattern = (term: string) => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const allowed = /(?:^|\s)Sa$/.test(term) ? `(?!\\s+(?:${VIETNAMESE_SA_PLACES.join('|')})(?![\\p{L}]))` : '';
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])${allowed}`, 'iu');
};

/** Máy chủ ô bản đồ / dịch vụ bản đồ nền không được phép dùng trực tiếp ở frontend. */
const FORBIDDEN_TILE_HOSTS = [
  'tile.openstreetmap.org',
  'openstreetmap.org',
  'opentopomap.org',
  'arcgisonline.com',
  'basemaps.cartocdn.com',
  'cartocdn.com',
  'api.mapbox.com',
  'tiles.mapbox.com',
  'mt0.google.com',
  'mt1.google.com',
  'maps.googleapis.com',
  'tile.thunderforest.com',
  'stamen-tiles',
  'tiles.stadiamaps.com',
  'maptiler.com',
  'here.com',
  'amap.com',
  'map.baidu.com',
  'tianditu',
];

// ---------------------------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------------------------
const TEXT_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.html',
  '.css',
  '.md',
  '.webmanifest',
]);
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', '.vite', 'coverage', 'baselines'].includes(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (TEXT_EXT.has(extname(name))) out.push(path);
  }
  return out;
}
const rel = (path: string) => relative(root, path);
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const SELF = fileURLToPath(import.meta.url);
const UI_SOURCES = [
  ...walk(resolve(root, 'apps/web/src')),
  ...walk(resolve(root, 'apps/web/public')),
  resolve(root, 'apps/web/index.html'),
  ...walk(resolve(root, 'packages/shared/src')),
  ...walk(resolve(root, 'apps/api/src')),
].filter((path) => path !== SELF && !/\.test\.tsx?$/.test(path));

function tileXY(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return { x, y, z: zoom };
}
const inBounds = (
  p: { lat: number; lng: number },
  b: { south: number; west: number; north: number; east: number },
) => p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east;

async function get(url: string): Promise<Response | null> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch {
    return null;
  }
}

/** Cache ô vector Vietmap trong một lần chạy để hai cổng không gọi trùng (tiết kiệm hạn mức). */
const vectorTileCache = new Map<string, Promise<{ status: number; bytes: Uint8Array } | null>>();
let vietmapTemplate: Promise<string | null> | null = null;
async function vietmapVectorTemplate(): Promise<string | null> {
  vietmapTemplate ??= (async () => {
    const res = await get(`${API}/map/vietmap/styles/tm/style.json`);
    if (!res?.ok) return null;
    const style = (await res.json()) as { sources?: Record<string, { type?: string; tiles?: string[] }> };
    const source = Object.values(style.sources ?? {}).find((s) => s.type === 'vector' && s.tiles?.length);
    const tile = source?.tiles?.[0];
    if (!tile?.startsWith('https://maps.vietmap.vn/maps/')) return null;
    return `${API}/map/vietmap/${tile.slice('https://maps.vietmap.vn/maps/'.length)}`;
  })();
  return vietmapTemplate;
}
async function vietmapTile(z: number, x: number, y: number) {
  const key = `${z}/${x}/${y}`;
  if (!vectorTileCache.has(key))
    vectorTileCache.set(
      key,
      (async () => {
        const template = await vietmapVectorTemplate();
        if (!template) return null;
        const res = await get(
          template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)),
        );
        if (!res) return null;
        return {
          status: res.status,
          bytes: res.ok ? new Uint8Array(await res.arrayBuffer()) : new Uint8Array(),
        };
      })(),
    );
  return vectorTileCache.get(key)!;
}
/** Ô vector vApp: tải thẳng (hiển thị miễn phí, không cần khóa, không tính lượt). */
const VAPP_TILE = 'https://map.vapp.vn/tiles/basemap';
async function vappTile(z: number, x: number, y: number) {
  const res = await get(`${VAPP_TILE}/${z}/${x}/${y}`);
  if (!res) return null;
  let bytes = res.ok ? new Uint8Array(await res.arrayBuffer()) : new Uint8Array();
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = new Uint8Array(gunzipSync(bytes));
  return { status: res.status, bytes };
}
async function vnsdiTile(service: 'admin' | 'terrain', z: number, x: number, y: number) {
  const res = await get(`${API}/map/vnsdi/${service}/tile/${z}/${y}/${x}`);
  if (!res) return null;
  return {
    status: res.status,
    type: res.headers.get('content-type') ?? '',
    bytes: res.ok ? new Uint8Array(await res.arrayBuffer()) : new Uint8Array(),
  };
}
let apiHealth: Promise<{ ok: boolean; vnsdi: boolean; vietmap: boolean }> | null = null;
function health() {
  apiHealth ??= (async () => {
    const res = await get(`${API}/health`);
    if (!res?.ok) return { ok: false, vnsdi: false, vietmap: false };
    const body = (await res.json()) as {
      data?: { configured?: { routing?: string; vnsdiBasemap?: boolean } };
    };
    return {
      ok: true,
      vietmap: body.data?.configured?.routing === 'vietmap',
      vnsdi: Boolean(body.data?.configured?.vnsdiBasemap),
    };
  })();
  return apiHealth;
}

// ---------------------------------------------------------------------------------------------
// 1. Geographic Coverage
// ---------------------------------------------------------------------------------------------
async function coverageGate(gate: Gate) {
  for (const archipelago of VIETNAM_ARCHIPELAGOS) {
    const islands = VIETNAM_ISLANDS.filter((i) => inBounds(i, archipelago.bounds));
    gate.expect(
      islands.length >= 3 &&
        inBounds({ lat: archipelago.label[0], lng: archipelago.label[1] }, archipelago.bounds),
      `${archipelago.name.vi}: nhãn và ${islands.length} đảo tiêu biểu nằm trong vùng bao`,
      `${archipelago.name.vi}: thiếu đảo tiêu biểu hoặc nhãn nằm ngoài vùng bao`,
    );
  }
  const orphan = VIETNAM_ISLANDS.filter((i) => !VIETNAM_ARCHIPELAGOS.some((a) => inBounds(i, a.bounds)));
  gate.expect(
    orphan.length === 0,
    'Mọi đảo tiêu biểu thuộc Hoàng Sa hoặc Trường Sa',
    `Đảo nằm ngoài cả hai quần đảo: ${orphan.map((i) => i.name.vi).join(', ')}`,
  );

  const controller = read('apps/web/src/features/map/services/LeafletMapController.ts');
  gate.expect(
    !/maxBounds\s*:/.test(controller),
    'Bản đồ không giới hạn maxBounds, người dùng kéo tới được Hoàng Sa và Trường Sa',
    'LeafletMapController đặt maxBounds: kiểm tra Hoàng Sa (tới 113.3°E) và Trường Sa (tới 118.1°E) còn xem được',
  );

  const outsideRouting = REFERENCE_POINTS.filter(
    (p) =>
      p.kind !== 'archipelago' &&
      VIETNAM_ARCHIPELAGOS.every((a) => !inBounds(p, a.bounds)) &&
      !(
        p.lat >= VIETMAP_COVERAGE.minLat &&
        p.lat <= VIETMAP_COVERAGE.maxLat &&
        p.lng >= VIETMAP_COVERAGE.minLng &&
        p.lng <= VIETMAP_COVERAGE.maxLng
      ),
  );
  if (outsideRouting.length)
    gate.warn(
      `Vùng chỉ đường VietMap (VIETMAP_COVERAGE) chưa phủ: ${outsideRouting.map((p) => p.name).join(', ')} — bản đồ vẫn hiển thị, chỉ không tính tuyến`,
    );
  else gate.pass('Vùng chỉ đường VietMap phủ mọi điểm cực và đảo có đường bộ');

  if (!LIVE) {
    gate.skip('Kiểm tra ô bản đồ thật bỏ qua (chạy với --live)');
    return;
  }
  // vApp (nền chính Đường phố/Tối): ô vector mức 10 tại từng điểm chuẩn.
  const missingVapp: string[] = [];
  for (const p of REFERENCE_POINTS) {
    const t = tileXY(p.lat, p.lng, 10);
    const tile = await vappTile(t.z, t.x, t.y);
    if (!tile || tile.status !== 200 || tile.bytes.length === 0)
      missingVapp.push(`${p.name} (${tile?.status ?? 'lỗi mạng'})`);
  }
  gate.expect(
    missingVapp.length === 0,
    `vApp có dữ liệu ô vector tại cả ${REFERENCE_POINTS.length} điểm chuẩn (đất liền, đảo, Hoàng Sa, Trường Sa)`,
    `vApp thiếu ô tại: ${missingVapp.join('; ')}`,
  );

  const h = await health();
  if (!h.ok) {
    gate.fail(`Không gọi được API ${API}/health — hãy chạy API trước khi dùng --live`);
    return;
  }
  // Vietmap (Vệ tinh và dự phòng): ô vector mức 10 tại từng điểm chuẩn.
  const missingVietmap: string[] = [];
  for (const p of REFERENCE_POINTS) {
    const t = tileXY(p.lat, p.lng, 10);
    const tile = await vietmapTile(t.z, t.x, t.y);
    if (!tile || tile.status !== 200 || tile.bytes.length === 0)
      missingVietmap.push(`${p.name} (${tile?.status ?? 'lỗi mạng'})`);
  }
  if (missingVietmap.length === 0)
    gate.pass(`Vietmap có dữ liệu ô vector tại cả ${REFERENCE_POINTS.length} điểm chuẩn`);
  else if (missingVietmap.every((m) => m.endsWith('(423)')))
    gate.warn(
      'Vietmap trả 423 cho mọi ô (hết hạn mức HOẶC khóa chưa bật dịch vụ Tile/khóa "public tile"): Vietmap tạm không dùng được, các nền khác vẫn chạy',
    );
  else gate.fail(`Vietmap thiếu ô tại: ${missingVietmap.join('; ')}`);
  // VNSDI: ô ảnh mức 8.
  if (!h.vnsdi) {
    gate.warn(
      'VNSDI chưa cấu hình VNSDI_BASEMAP_TOKEN ở apps/api/.env — lớp Hành chính/Địa hình và nền dự phòng không chạy',
    );
    return;
  }
  const missingVnsdi: string[] = [];
  for (const p of REFERENCE_POINTS) {
    const t = tileXY(p.lat, p.lng, 8);
    const tile = await vnsdiTile('admin', t.z, t.x, t.y);
    if (!tile || tile.status !== 200 || !tile.type.startsWith('image/'))
      missingVnsdi.push(`${p.name} (${tile?.status ?? 'lỗi mạng'})`);
  }
  gate.expect(
    missingVnsdi.length === 0,
    `VNSDI (bản đồ hành chính nhà nước) có ô ảnh tại cả ${REFERENCE_POINTS.length} điểm chuẩn`,
    `VNSDI thiếu ô tại: ${missingVnsdi.join('; ')}`,
  );
}

// ---------------------------------------------------------------------------------------------
// 2. Boundary Validation
// ---------------------------------------------------------------------------------------------
async function boundaryGate(gate: Gate) {
  // Nền bản đồ chỉ từ Vietmap + VNSDI (VNSDI là nguồn đường biên giới, địa giới chính thức của Nhà nước).
  const offenders: string[] = [];
  for (const file of UI_SOURCES.filter((f) => f.includes('/apps/web/'))) {
    const text = readFileSync(file, 'utf8');
    // Link bản quyền bắt buộc (ODbL: openstreetmap.org/copyright) là ghi nguồn, không phải tải bản đồ.
    const checked = text.replaceAll('https://www.openstreetmap.org/copyright', '');
    for (const host of FORBIDDEN_TILE_HOSTS)
      if (checked.includes(host)) offenders.push(`${rel(file)} → ${host}`);
    for (const m of text.matchAll(/https?:\/\/[^'"`\s]*\{z\}[^'"`\s]*/g))
      if (!(MAP_TILE_SOURCES as readonly string[]).includes(new URL(m[0].replace(/[{}]/g, '')).origin))
        offenders.push(`${rel(file)} → ô bản đồ trực tiếp ${m[0]}`);
  }
  gate.expect(
    offenders.length === 0,
    'Frontend không tải ô bản đồ từ OSM/Esri/nhà cung cấp nước ngoài; chỉ nguồn trong registry',
    `Nguồn ô bản đồ không được phép:\n      ${offenders.join('\n      ')}`,
  );

  // Registry: production chỉ dùng nguồn APPROVED có người duyệt; không bao giờ dùng OSM nguyên bản.
  const modes = Object.keys(MODE_CHAINS) as BasemapMode[];
  const prodBad = modes.flatMap((m) =>
    usableChain(m, true)
      .filter((p) => p.status !== 'APPROVED' || !p.approval)
      .map((p) => `${m}:${p.id}`),
  );
  gate.expect(
    prodBad.length === 0,
    'Production chỉ dùng nguồn APPROVED có người phê duyệt',
    `Production dùng nguồn chưa duyệt: ${prodBad.join(', ')}`,
  );
  const approved = BASEMAP_PROVIDERS.filter((p) => p.status === 'APPROVED');
  if (approved.length === 0)
    gate.warn(
      'Chưa có nguồn nào APPROVED: bản build production sẽ hiện "Bản đồ nền tạm thời không khả dụng" cho tới khi người phụ trách duyệt',
    );
  const osmUsable = modes.flatMap((m) => usableChain(m, false)).filter((p) => /^osm/.test(p.id));
  gate.expect(
    osmUsable.length === 0,
    'OpenStreetMap nguyên bản không có trong chuỗi nền nào (kể cả dự phòng)',
    'OSM nguyên bản đang được dùng làm nền',
  );
  gate.pass(`Trạng thái nguồn: ${BASEMAP_PROVIDERS.map((p) => `${p.id}=${p.status}`).join(', ')}`);
  const vapp = read('apps/web/src/features/map/services/leaflet/VappLayer.ts');
  gate.expect(
    !/visibility|\.filter\(|sov-/.test(vapp.replace(/\/\*[\s\S]*?\*\//g, '')),
    'Không ẩn, lọc hay đổi lớp chủ quyền (sov-*) của nguồn vApp',
    'VappLayer đang ẩn/lọc/đổi lớp của style nguồn',
  );

  // Điều 20.1–20.3 TT 17/2018/TT-BTNMT: khung toàn vẹn lãnh thổ và bản đồ phụ.
  const e = VIETNAM_TERRITORY_EXTENT;
  gate.expect(
    e.south === 4.5 && e.north === 23.5 && e.west === 102 && e.east === 118,
    'Khung toàn vẹn lãnh thổ 4°30′–23°30′B, 102°–118°Đ đúng Điều 20.1',
    'Khung toàn vẹn lãnh thổ sai so với Điều 20.1',
  );
  const partial = [
    { name: 'TP. Hồ Chí Minh', south: 10.6, west: 106.5, north: 10.95, east: 106.9 },
    { name: 'Đà Nẵng', south: 15.9, west: 108.0, north: 16.2, east: 108.35 },
    { name: 'Khánh Hòa', south: 12.0, west: 108.9, north: 12.5, east: 109.4 },
    { name: 'An Giang / Phú Quốc', south: 9.9, west: 103.8, north: 10.5, east: 104.2 },
  ];
  const missingInset = partial.filter((v) => !needsTerritoryInset(v)).map((v) => v.name);
  gate.expect(
    missingInset.length === 0 && !needsTerritoryInset({ south: 3, west: 100, north: 25, east: 120 }),
    'Bản đồ phụ bật khi xem một phần lãnh thổ (Đà Nẵng, Khánh Hòa, TP.HCM, An Giang…) và tắt khi đã thấy toàn vẹn',
    `Thiếu bản đồ phụ khi xem: ${missingInset.join(', ')}`,
  );
  const controller0 = read('apps/web/src/features/map/services/LeafletMapController.ts');
  gate.expect(
    /new VietnamInset\(/.test(controller0) &&
      /VIETNAM_TERRITORY_BOUNDS/.test(read('apps/web/src/features/map/services/leaflet/MapCamera.ts')),
    'Bản đồ chính có bản đồ phụ; nút "Xem toàn Việt Nam" khớp khung Điều 20.1',
    'Thiếu bản đồ phụ hoặc nút tổng quan chưa khớp khung Điều 20.1',
  );

  const api = read('apps/api/src/modules/map/presentation/vnsdiBasemapRouter.ts');
  gate.expect(
    api.includes('https://vnsdi.mae.gov.vn') && api.includes('BanDoHanhChinhVietNam'),
    'Proxy API trỏ tới dịch vụ chính thức vnsdi.mae.gov.vn/BanDoHanhChinhVietNam',
    'Proxy VNSDI không trỏ tới máy chủ chính thức',
  );

  const controller = read('apps/web/src/features/map/services/LeafletMapController.ts');
  gate.expect(
    /new ArchipelagoLabels\(/.test(controller),
    'Nhãn chủ quyền của iMap (ArchipelagoLabels) hiện trên nền không tự có nhãn; tắt khi nguồn đã thể hiện để không chồng chữ',
    'LeafletMapController không tạo ArchipelagoLabels',
  );
  const hs = VIETNAM_ARCHIPELAGOS.find((a) => a.id === 'hoang-sa');
  const ts = VIETNAM_ARCHIPELAGOS.find((a) => a.id === 'truong-sa');
  gate.expect(
    Boolean(
      hs &&
      ts &&
      hs.bounds.south >= 15 &&
      hs.bounds.north <= 17.8 &&
      ts.bounds.south >= 5.5 &&
      ts.bounds.north <= 12.5,
    ),
    'Vùng bao Hoàng Sa (15–17,8°N) và Trường Sa (5,5–12,5°N) đúng vị trí',
    'Vùng bao quần đảo sai vị trí',
  );

  if (!LIVE) {
    gate.skip('Kiểm tra đường biên thật trên ô VNSDI bỏ qua (chạy với --live)');
    return;
  }
  const h = await health();
  if (!h.ok || !h.vnsdi) {
    gate.fail(
      'Cần API đang chạy và VNSDI_BASEMAP_TOKEN để đối chiếu đường biên với bản đồ hành chính nhà nước',
    );
    return;
  }
  // Ô VNSDI phủ hai quần đảo phải có nội dung (không trống) — bản đồ nhà nước luôn thể hiện Hoàng Sa, Trường Sa.
  for (const a of VIETNAM_ARCHIPELAGOS) {
    const t = tileXY(a.label[0], a.label[1], 6);
    const tile = await vnsdiTile('admin', t.z, t.x, t.y);
    gate.expect(
      Boolean(tile && tile.status === 200 && tile.bytes.length > 2_000),
      `VNSDI thể hiện ${a.name.vi} ở mức 6 (${tile?.bytes.length ?? 0} byte)`,
      `Ô VNSDI tại ${a.name.vi} trống hoặc lỗi (${tile?.status ?? 'lỗi mạng'})`,
    );
  }
}

// ---------------------------------------------------------------------------------------------
// 3. Place Name Validation
// ---------------------------------------------------------------------------------------------
function scanForbidden(text: string): { term: string; why: string }[] {
  return FORBIDDEN_NAMES.filter(({ term }) => forbiddenPattern(term).test(text));
}
async function namesGate(gate: Gate) {
  const hits: string[] = [];
  for (const file of UI_SOURCES) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      for (const { term, why } of scanForbidden(line))
        hits.push(`${rel(file)}:${index + 1} "${term}" — ${why}`);
    });
  }
  gate.expect(
    hits.length === 0,
    `Không có tên sai chủ quyền trong ${UI_SOURCES.length} file UI/API/dữ liệu`,
    `Tên sai chủ quyền:\n      ${hits.join('\n      ')}`,
  );

  const required: [string, string][] = [
    ['Quần đảo Hoàng Sa', 'vi'],
    ['Quần đảo Trường Sa', 'vi'],
    ['Biển Đông', 'vi'],
    ['Hoang Sa Archipelago', 'en'],
    ['Truong Sa Archipelago', 'en'],
    ['East Sea', 'en'],
  ];
  const names = [
    ...VIETNAM_ARCHIPELAGOS.flatMap((a) => [a.name.vi, a.name.en]),
    EAST_SEA.name.vi,
    EAST_SEA.name.en,
  ];
  const missing = required.filter(([name]) => !names.includes(name));
  gate.expect(
    missing.length === 0,
    'Đủ tên chuẩn: Quần đảo Hoàng Sa, Quần đảo Trường Sa, Biển Đông (VI/EN)',
    `Thiếu tên chuẩn: ${missing.map(([n]) => n).join(', ')}`,
  );
  gate.expect(
    SOVEREIGN_NAME.vi === 'Việt Nam' && SOVEREIGN_NAME.en === 'Viet Nam',
    'Nhãn quần đảo kèm "(Việt Nam)" / "(Viet Nam)"',
    'Thiếu nhãn sở hữu "(Việt Nam)" dưới tên quần đảo',
  );
  gate.expect(
    EAST_SEA.label[0] > 5 && EAST_SEA.label[0] < 23 && EAST_SEA.label[1] > 109 && EAST_SEA.label[1] < 120,
    'Nhãn Biển Đông đặt giữa Biển Đông',
    'Nhãn Biển Đông đặt sai vị trí',
  );
  const islandNames = VIETNAM_ISLANDS.map((i) => i.name.vi);
  for (const must of [
    'Đảo Phú Lâm',
    'Đảo Hoàng Sa',
    'Đảo Trường Sa',
    'Đảo Song Tử Tây',
    'Đảo Ba Bình',
    'Đảo Nam Yết',
    'Đảo Sinh Tồn',
  ])
    if (!islandNames.includes(must)) gate.fail(`Thiếu đảo tiêu biểu "${must}"`);
  if (islandNames.length)
    gate.pass(
      `${islandNames.length} đảo tiêu biểu mang tên Việt Nam (hiện từ mức zoom ${ISLAND_LABEL_MIN_ZOOM})`,
    );

  if (!LIVE) {
    gate.skip('Quét tên trong ô vector vApp/Vietmap thật bỏ qua (chạy với --live)');
    return;
  }
  // Quét chuỗi UTF-8 trong ô vector (MVT lưu tên dạng văn bản thô) quanh Biển Đông, Hoàng Sa, Trường Sa.
  const tiles = new Map<string, { z: number; x: number; y: number }>();
  for (const z of [4, 5, 6]) {
    for (let lat = 6; lat <= 23; lat += z === 4 ? 6 : z === 5 ? 4 : 3)
      for (let lng = 103; lng <= 118; lng += z === 4 ? 6 : z === 5 ? 4 : 3) {
        const t = tileXY(lat, lng, z);
        tiles.set(`${t.z}/${t.x}/${t.y}`, t);
      }
  }
  for (const a of VIETNAM_ARCHIPELAGOS)
    for (const z of [7, 8]) {
      const t = tileXY(a.label[0], a.label[1], z);
      tiles.set(`${t.z}/${t.x}/${t.y}`, t);
    }
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const scan = async (
    label: string,
    fetchTile: (z: number, x: number, y: number) => Promise<{ status: number; bytes: Uint8Array } | null>,
  ) => {
    const hits: string[] = [];
    let scanned = 0;
    for (const t of tiles.values()) {
      const tile = await fetchTile(t.z, t.x, t.y);
      if (!tile || tile.status !== 200) continue;
      scanned++;
      for (const { term, why } of scanForbidden(decoder.decode(tile.bytes)))
        hits.push(`ô ${t.z}/${t.x}/${t.y}: "${term}" — ${why}`);
    }
    return { scanned, hits, label };
  };
  const vapp = await scan('vApp', vappTile);
  gate.expect(
    vapp.scanned > 0,
    `Đã quét ${vapp.scanned} ô vector vApp quanh Biển Đông`,
    'Không tải được ô vector vApp nào để quét tên',
  );
  gate.expect(
    vapp.hits.length === 0,
    'Dữ liệu vApp không chứa tên sai chủ quyền',
    `Dữ liệu nền vApp chứa tên sai:\n      ${vapp.hits.join('\n      ')}`,
  );
  const vappStyle = await get('https://map.vapp.vn/style.json');
  const vappStyleHits = vappStyle?.ok ? scanForbidden(await vappStyle.text()) : [];
  gate.expect(
    Boolean(vappStyle?.ok) && vappStyleHits.length === 0,
    'Style vApp sạch tên sai',
    `Style vApp lỗi tải hoặc chứa: ${vappStyleHits.map((x) => x.term).join(', ')}`,
  );

  const h = await health();
  if (!h.ok || !h.vietmap) {
    gate.warn('Bỏ qua quét dữ liệu Vietmap: API chưa chạy hoặc chưa có VIETMAP_API_KEY');
    return;
  }
  const vietmap = await scan('Vietmap', vietmapTile);
  if (vietmap.scanned === 0)
    gate.warn('Không tải được ô vector Vietmap để quét tên (423: hết hạn mức hoặc khóa chưa bật Tile)');
  else
    gate.expect(
      vietmap.hits.length === 0,
      `Đã quét ${vietmap.scanned} ô Vietmap: không có tên sai chủ quyền`,
      `Dữ liệu nền Vietmap chứa tên sai:\n      ${vietmap.hits.join('\n      ')}`,
    );
  for (const id of ['tm', 'dm', 'hm']) {
    const res = await get(`${API}/map/vietmap/styles/${id}/style.json`);
    const hits2 = res?.ok ? scanForbidden(await res.text()) : [];
    gate.expect(
      Boolean(res?.ok) && hits2.length === 0,
      `Style Vietmap "${id}" sạch tên sai`,
      `Style Vietmap "${id}" lỗi tải hoặc chứa: ${hits2.map((h2) => h2.term).join(', ')}`,
    );
  }
}

// ---------------------------------------------------------------------------------------------
// 4. License Validation
// ---------------------------------------------------------------------------------------------
async function licenseGate(gate: Gate) {
  const vietmapLayer = read('apps/web/src/features/map/services/leaflet/VietmapLayer.ts');
  gate.expect(
    /© Vietmap/.test(vietmapLayer),
    'Ghi nguồn "© Vietmap" trên nền Vietmap',
    'Thiếu ghi nguồn Vietmap',
  );
  // Mỗi nguồn trong registry có ghi nguồn và giấy phép; nguồn đang dùng được phải có ghi nguồn bắt buộc.
  const attributionRules: Record<string, RegExp[]> = {
    vapp: [/© map\.vapp\.vn/, /© OpenStreetMap/],
    'vnsdi-admin': [/Cục Đo đạc, Bản đồ và Thông tin địa lý Việt Nam/, /VNSDI/],
    'vnsdi-terrain': [/VNSDI/, /NASA, JAXA/],
    'vnsdi-sentinel2': [/VNSDI/, /Sentinel-2/],
    vietmap: [/© Vietmap/],
  };
  for (const [id, rules] of Object.entries(attributionRules)) {
    const p = BASEMAP_PROVIDERS.find((x) => x.id === id);
    gate.expect(
      Boolean(p && rules.every((r) => r.test(p.attribution)) && p.license),
      `${id}: ghi nguồn đủ (${rules.map((r) => r.source.replace(/\\/g, '')).join(' · ')}) và có điều kiện giấy phép`,
      `${id}: thiếu ghi nguồn bắt buộc hoặc thiếu thông tin giấy phép`,
    );
  }
  const unclear = BASEMAP_PROVIDERS.filter((p) => p.status === 'TESTING').map(
    (p) => `${p.id}: ${p.blockers[0]}`,
  );
  if (unclear.length)
    gate.warn(`Quyền sử dụng chưa xác nhận đủ để duyệt production:\n      ${unclear.join('\n      ')}`);

  const controller = read('apps/web/src/features/map/services/LeafletMapController.ts');
  gate.expect(
    !/attributionControl:\s*false/.test(controller),
    'Khung ghi nguồn bản đồ luôn hiển thị',
    'attributionControl bị tắt',
  );

  // Dữ liệu OSM (ODbL) còn dùng ở đâu thì phải ghi nguồn ở đó.
  const usesOverpass =
    existsSync(
      resolve(root, 'apps/api/src/modules/route-stops/infrastructure/providers/OverpassStopPlaceProvider.ts'),
    ) && /OverpassStopPlaceProvider/.test(read('apps/api/src/compositionRoot.ts'));
  if (usesOverpass) {
    const assistant = read('apps/web/src/features/place-assistant/components/AssistantResults.tsx');
    const panel = read('apps/web/src/features/places/components/PlacePanel.tsx');
    gate.expect(
      /Nguồn OSM/.test(assistant) && /OpenStreetMap/.test(panel),
      'Trợ lý địa điểm dùng dữ liệu OSM (ODbL) và có ghi nguồn OpenStreetMap',
      'Đang dùng dữ liệu OSM (Overpass) nhưng thiếu ghi nguồn theo ODbL',
    );
    gate.warn(
      'Còn dùng dữ liệu gốc OpenStreetMap: nền vApp (dựng từ OSM, Overture, Wikidata) và trợ lý địa điểm (Overpass). Giao diện không còn là OSM; đã ghi nguồn theo ODbL.',
    );
  } else gate.pass('Không dùng dữ liệu OSM');

  // Khóa/token không được lộ ở frontend.
  const leaks: string[] = [];
  for (const file of UI_SOURCES.filter((f) => f.includes('/apps/web/'))) {
    const text = readFileSync(file, 'utf8');
    if (/VITE_[A-Z_]*(VIETMAP|VNSDI)/.test(text)) leaks.push(`${rel(file)}: biến VITE_ chứa khóa bản đồ`);
    if (/[?&](apikey|token)=[A-Za-z0-9_-]{12,}/.test(text))
      leaks.push(`${rel(file)}: chuỗi apikey/token cứng`);
  }
  for (const envFile of [
    'apps/web/.env',
    'apps/web/.env.example',
    'apps/web/.env.production',
    'apps/web/.env.local',
  ]) {
    const path = resolve(root, envFile);
    if (existsSync(path) && /^(VITE_)?[A-Z_]*(VIETMAP|VNSDI)[A-Z_]*=\S+/m.test(readFileSync(path, 'utf8')))
      leaks.push(`${envFile}: chứa khóa Vietmap/VNSDI`);
  }
  gate.expect(
    leaks.length === 0,
    'Khóa Vietmap và token VNSDI chỉ nằm ở API, không lộ ra trình duyệt',
    `Lộ khóa:\n      ${leaks.join('\n      ')}`,
  );

  const example = read('apps/api/.env.example');
  gate.expect(
    /VIETMAP_API_KEY=/.test(example) && /VNSDI_BASEMAP_TOKEN=/.test(example),
    'apps/api/.env.example hướng dẫn VIETMAP_API_KEY và VNSDI_BASEMAP_TOKEN',
    'apps/api/.env.example thiếu VIETMAP_API_KEY hoặc VNSDI_BASEMAP_TOKEN',
  );

  if (LIVE) {
    const h = await health();
    gate.expect(h.vietmap, 'API đã cấu hình khóa Vietmap', 'API chưa có VIETMAP_API_KEY');
    gate.expect(
      h.vnsdi,
      'API đã cấu hình token VNSDI',
      'API chưa có VNSDI_BASEMAP_TOKEN — đăng ký tại vnsdi.mae.gov.vn',
    );
  } else gate.skip('Kiểm tra khóa đã cấu hình trên API bỏ qua (chạy với --live)');
}

// ---------------------------------------------------------------------------------------------
// 5. Visual Regression Testing
// ---------------------------------------------------------------------------------------------
type View = {
  id: string;
  center: [number, number];
  zoom: number;
  language: 'vi' | 'en';
  layer: 'street' | 'admin' | 'dark' | 'satellite';
  /** Nhãn chủ quyền của iMap phải thấy (chỉ khi nền không tự có nhãn). */
  expectText: string[];
  /** Có phải hiện bản đồ phụ (Điều 20.2–20.3) không. */
  expectInset: boolean;
};
const VIEWS: View[] = [
  {
    id: 'vietnam-z5-vi',
    center: [14, 110],
    zoom: 5,
    language: 'vi',
    layer: 'street',
    expectInset: false,
    expectText: ['Quần đảo Hoàng Sa', 'Quần đảo Trường Sa', '(Việt Nam)', 'Biển Đông'],
  },
  {
    id: 'vietnam-z5-en',
    center: [14, 110],
    zoom: 5,
    language: 'en',
    layer: 'street',
    expectInset: false,
    expectText: ['Hoang Sa Archipelago', 'Truong Sa Archipelago', '(Viet Nam)', 'East Sea'],
  },
  {
    id: 'vietnam-dark-z5',
    center: [14, 110],
    zoom: 5,
    language: 'vi',
    layer: 'dark',
    expectInset: false,
    expectText: ['Quần đảo Hoàng Sa', 'Quần đảo Trường Sa', 'Biển Đông'],
  },
  {
    id: 'vietnam-satellite-z5',
    center: [14, 110],
    zoom: 5,
    language: 'vi',
    layer: 'satellite',
    expectInset: false,
    expectText: ['Quần đảo Hoàng Sa', 'Quần đảo Trường Sa', 'Biển Đông'],
  },
  {
    id: 'vietnam-admin-z5',
    center: [14, 110],
    zoom: 5,
    language: 'vi',
    layer: 'admin',
    expectInset: false,
    expectText: ['Quần đảo Hoàng Sa', 'Quần đảo Trường Sa'],
  },
  {
    id: 'hoang-sa-z9',
    center: [16.6, 112.0],
    zoom: 9,
    language: 'vi',
    layer: 'street',
    expectInset: true,
    expectText: ['Đảo Phú Lâm', 'Đảo Hoàng Sa', 'Đảo Quang Hòa'],
  },
  {
    id: 'truong-sa-z9',
    center: [10.4, 114.4],
    zoom: 9,
    language: 'vi',
    layer: 'street',
    expectInset: true,
    expectText: ['Đảo Ba Bình', 'Đảo Nam Yết', 'Đảo Sơn Ca'],
  },
  {
    id: 'ho-chi-minh-z12',
    center: [10.776, 106.7],
    zoom: 12,
    language: 'vi',
    layer: 'street',
    expectInset: true,
    expectText: [],
  },
  {
    id: 'ha-noi-z12',
    center: [21.028, 105.854],
    zoom: 12,
    language: 'vi',
    layer: 'street',
    expectInset: true,
    expectText: [],
  },
  {
    id: 'da-nang-z10',
    center: [16.054, 108.202],
    zoom: 10,
    language: 'vi',
    layer: 'street',
    expectInset: true,
    expectText: [],
  },
  {
    id: 'khanh-hoa-z10',
    center: [12.24, 109.19],
    zoom: 10,
    language: 'vi',
    layer: 'street',
    expectInset: true,
    expectText: [],
  },
  {
    id: 'phu-quoc-an-giang-z10',
    center: [10.23, 103.96],
    zoom: 10,
    language: 'vi',
    layer: 'street',
    expectInset: true,
    expectText: [],
  },
  {
    id: 'con-dao-z12',
    center: [8.683, 106.608],
    zoom: 12,
    language: 'vi',
    layer: 'street',
    expectInset: true,
    expectText: [],
  },
  {
    id: 'bien-gioi-phia-bac-z8',
    center: [22.6, 105.0],
    zoom: 8,
    language: 'vi',
    layer: 'street',
    expectInset: true,
    expectText: [],
  },
  {
    id: 'ho-chi-minh-z16',
    center: [10.776, 106.7],
    zoom: 16,
    language: 'vi',
    layer: 'street',
    expectInset: true,
    expectText: [],
  },
];
const DIFF_TOLERANCE = 0.01; // 1% điểm ảnh

async function visualGate(gate: Gate) {
  const { chromium } = await import('playwright');
  const { createServer } = await import('vite');
  const fixtureTile = readFileSync(resolve(root, 'apps/web/public/favicon-32.png'));
  mkdirSync(REPORT_DIR, { recursive: true });
  mkdirSync(BASELINE_DIR, { recursive: true });

  const cwd = process.cwd();
  process.chdir(resolve(root, 'apps/web'));
  const server = await createServer({
    root: resolve(root, 'apps/web'),
    server: {
      host: '127.0.0.1',
      port: 5310,
      strictPort: false,
      ...(LIVE ? { proxy: { '/api': API.replace(/\/api$/, '') } } : {}),
    },
    logLevel: 'error',
  });
  await server.listen();
  const address = server.httpServer!.address();
  const port = typeof address === 'object' && address ? address.port : 5310;
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-unsafe-swiftshader'],
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 860 },
      reducedMotion: 'reduce',
      deviceScaleFactor: 1,
    });
    if (!LIVE) {
      // Ô giả lập cố định: so ảnh chỉ phản ánh nhãn chủ quyền, ghi nguồn và giao diện của iMap.
      await context.route(/^https?:\/\//, async (route) => {
        const url = new URL(route.request().url());
        if (url.hostname === '127.0.0.1' && !url.pathname.startsWith('/api/')) return route.continue();
        // vApp tự vẽ nhãn chủ quyền trên canvas (không so được bằng DOM): offline cho vApp "không phản hồi"
        // để kiểm chứng cả đường dự phòng; nhãn của vApp được kiểm ở chế độ --live (quét ô + ảnh chụp).
        if (url.hostname === 'map.vapp.vn')
          return route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: '' });
        const style = /\/map\/vietmap\/styles\/(tm|dm|hm)\/style\.json$/.exec(url.pathname)?.[1];
        if (style)
          return route.fulfill({
            json: {
              version: 8,
              sources: {},
              layers: [
                {
                  id: 'background',
                  type: 'background',
                  paint: {
                    'background-color': style === 'dm' ? '#101a29' : style === 'hm' ? '#2b3a2f' : '#e8ece7',
                  },
                },
              ],
            },
          });
        if (route.request().resourceType() === 'image' || url.pathname.startsWith('/api/map/'))
          return route.fulfill({ contentType: 'image/png', body: fixtureTile });
        return route.abort();
      });
    }
    const page = await context.newPage();
    // tsx/esbuild chèn __name() vào hàm gửi sang trình duyệt; định nghĩa sẵn để page.evaluate chạy được.
    await page.addInitScript({ content: 'globalThis.__name = (f) => f;' });
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForLoadState('domcontentloaded');

    for (const view of VIEWS) {
      await page.evaluate(async (v) => {
        document.getElementById('sov-map')?.remove();
        const w = window as unknown as { __sov?: { destroy(): void } };
        w.__sov?.destroy();
        const { LeafletMapController } = await import('/src/features/map/services/LeafletMapController.ts');
        const { toTrafficMapLayer } = await import('/src/features/traffic/domain/trafficMapLayer.ts');
        const el = document.createElement('div');
        el.id = 'sov-map';
        el.className = 'routetwin-leaflet';
        el.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#e8ece7';
        document.body.append(el);
        const c = new LeafletMapController(el, {
          onBoundsChange() {},
          onMapClick() {},
          onSelectRoute() {},
          onPoiClick() {},
        });
        c.update({
          language: v.language,
          layer: v.layer,
          route: null,
          routeOptions: [],
          draftStops: { origin: null, destination: null },
          trafficLayer: toTrafficMapLayer([]),
          currentLocation: null,
          headingDegrees: null,
          isNavigating: false,
          isPicking: false,
          overlays: { traffic: false, incidents: false, terrain: false },
          pois: [],
          highlightedPoiId: null,
        });
        (c as unknown as { map: { setView(c: [number, number], z: number, o: object): void } }).map.setView(
          v.center,
          v.zoom,
          { animate: false },
        );
        w.__sov = c as unknown as { destroy(): void };
      }, view);
      await page.waitForTimeout(LIVE ? 4_000 : 900);

      // Nguồn đang hiển thị, khung ghi nguồn, nhãn chủ quyền và bản đồ phụ.
      const state = await page.evaluate((texts) => {
        const map = document.getElementById('sov-map')!;
        const inView = (el: Element) => {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return (
            r.right > 0 &&
            r.bottom > 0 &&
            r.left < innerWidth &&
            r.top < innerHeight &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            Number(style.opacity) > 0.5
          );
        };
        const shown = [...map.querySelectorAll('.sovereignty-label')]
          .filter(inView)
          .map((el) => el.textContent ?? '');
        const all = shown.join(' | ');
        const inset = map.querySelector<HTMLElement>('.routetwin-territory-inset');
        const box = inset?.getBoundingClientRect();
        const insetLabels = [...map.querySelectorAll('.routetwin-territory-inset__label span')].map((el) => {
          const r = el.getBoundingClientRect();
          return {
            text: (el.textContent ?? '').replace(/\s+/g, ' '),
            inside: Boolean(
              box && r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom,
            ),
          };
        });
        return {
          basemap: map.dataset.basemap ?? null,
          notice: Boolean(map.querySelector('.routetwin-basemap-notice')),
          missing: texts.filter((t) => !all.includes(t)),
          attribution: map.querySelector('.leaflet-control-attribution')?.textContent ?? '',
          inset:
            inset && !inset.hidden ? { bounds: inset.dataset.insetBounds ?? '', labels: insetLabels } : null,
        };
      }, view.expectText);
      const provider = BASEMAP_PROVIDERS.find((p) => p.id === state.basemap);
      if (!provider) {
        gate.warn(
          `[${view.id}] không có nguồn nền nào (đang hiện thông báo: ${state.notice ? 'có' : 'KHÔNG'})`,
        );
        if (!state.notice) gate.fail(`[${view.id}] nền trống mà không có thông báo cho người dùng`);
      } else {
        const marker = provider.attribution
          .replace(/<[^>]+>/g, '')
          .split('·')[0]!
          .replace('©', '')
          .trim();
        gate.expect(
          state.attribution.includes(marker),
          `[${view.id}] nền ${provider.id} (${provider.status}), ghi nguồn "${marker}"`,
          `[${view.id}] nền ${provider.id} thiếu ghi nguồn "${marker}" (đang có: "${state.attribution.trim()}")`,
        );
      }
      if (provider?.sovereigntyLabels)
        gate.pass(
          `[${view.id}] tên chủ quyền do nguồn ${provider.id} thể hiện — đối chiếu bằng quét dữ liệu (--live) và ảnh chụp`,
        );
      else if (view.expectText.length)
        gate.expect(
          state.missing.length === 0,
          `[${view.id}] hiển thị: ${view.expectText.join(', ')}`,
          `[${view.id}] thiếu nhãn trên màn hình: ${state.missing.join(', ')}`,
        );
      if (view.expectInset) {
        const [w, sth, e, n] = (state.inset?.bounds ?? '').split(',').map(Number);
        const covers = Boolean(state.inset) && w! <= 102 && sth! <= 4.5 && e! >= 118 && n! >= 23.5;
        const labelsOk =
          Boolean(state.inset) &&
          ['Hoàng Sa', 'Trường Sa'].every((name) =>
            state.inset!.labels.some((l) => l.text.includes(name) && l.inside),
          );
        gate.expect(
          covers && labelsOk,
          `[${view.id}] có bản đồ phụ phủ 102°–118°Đ, 4°30′–23°30′B, ghi rõ Hoàng Sa, Trường Sa (Điều 20.2–20.3)`,
          `[${view.id}] thiếu/sai bản đồ phụ: ${state.inset ? `khung ${state.inset.bounds}, nhãn ${JSON.stringify(state.inset.labels)}` : 'không hiển thị'}`,
        );
      } else
        gate.expect(
          !state.inset,
          `[${view.id}] đang thấy toàn vẹn lãnh thổ, không cần bản đồ phụ`,
          `[${view.id}] hiện bản đồ phụ khi không cần`,
        );
      const banned = scanForbidden(await page.locator('#sov-map').innerText());
      gate.expect(
        banned.length === 0,
        `[${view.id}] không có tên sai trên bản đồ`,
        `[${view.id}] có tên sai: ${banned.map((b) => b.term).join(', ')}`,
      );

      const shot = await page.screenshot({ animations: 'disabled' });
      const file = `${view.id}${LIVE ? '-live' : ''}.png`;
      writeFileSync(join(REPORT_DIR, file), shot);
      if (LIVE) continue; // Ô thật thay đổi theo ngày: chỉ lưu ảnh để người duyệt xem, không so pixel.

      const baselinePath = join(BASELINE_DIR, file);
      if (UPDATE_BASELINE || !existsSync(baselinePath)) {
        writeFileSync(baselinePath, shot);
        gate.warn(
          `[${view.id}] ${UPDATE_BASELINE ? 'đã ghi lại' : 'tạo mới'} ảnh chuẩn ${rel(baselinePath)} — hãy duyệt bằng mắt`,
        );
        continue;
      }
      const ratio = await page.evaluate(
        async ([a, b]) => {
          const load = (data: string) =>
            new Promise<HTMLImageElement>((ok, bad) => {
              const img = new Image();
              img.onload = () => ok(img);
              img.onerror = bad;
              img.src = `data:image/png;base64,${data}`;
            });
          const [ia, ib] = await Promise.all([load(a), load(b)]);
          if (ia.width !== ib.width || ia.height !== ib.height) return 1;
          const px = (img: HTMLImageElement) => {
            const c = document.createElement('canvas');
            c.width = img.width;
            c.height = img.height;
            const ctx = c.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            return ctx.getImageData(0, 0, img.width, img.height).data;
          };
          const da = px(ia),
            db = px(ib);
          let diff = 0;
          for (let i = 0; i < da.length; i += 4)
            if (
              Math.abs(da[i]! - db[i]!) +
                Math.abs(da[i + 1]! - db[i + 1]!) +
                Math.abs(da[i + 2]! - db[i + 2]!) >
              48
            )
              diff++;
          return diff / (da.length / 4);
        },
        [shot.toString('base64'), readFileSync(baselinePath).toString('base64')] as const,
      );
      gate.expect(
        ratio <= DIFF_TOLERANCE,
        `[${view.id}] khớp ảnh chuẩn (lệch ${(ratio * 100).toFixed(2)}%)`,
        `[${view.id}] lệch ảnh chuẩn ${(ratio * 100).toFixed(2)}% > ${DIFF_TOLERANCE * 100}% — xem ${rel(join(REPORT_DIR, file))}`,
      );
    }
    if (LIVE) gate.pass(`Ảnh chụp bản đồ thật lưu ở ${rel(REPORT_DIR)} để duyệt bằng mắt`);
  } finally {
    await browser.close();
    await server.close();
    process.chdir(cwd);
  }
}

// ---------------------------------------------------------------------------------------------
// Chạy cổng
// ---------------------------------------------------------------------------------------------
const definitions: [GateId, string, (gate: Gate) => Promise<void>][] = [
  ['coverage', 'Geographic Coverage', coverageGate],
  ['boundary', 'Boundary Validation', boundaryGate],
  ['names', 'Place Name Validation', namesGate],
  ['license', 'License Validation', licenseGate],
  ['visual', 'Visual Regression Testing', visualGate],
];

console.log(`\nVietnam Sovereignty Validation — cổng kiểm chứng bắt buộc${LIVE ? ' (LIVE)' : ''}\n`);
const results: Gate[] = [];
for (const [id, title, run] of definitions) {
  if (only && !only.has(id)) continue;
  const gate = new Gate(id, title);
  try {
    await run(gate);
  } catch (error) {
    gate.fail(`Lỗi khi chạy cổng: ${error instanceof Error ? error.message : String(error)}`);
  }
  results.push(gate);
  const icon = { PASS: '✓', FAIL: '✗', WARN: '!', SKIP: '–' }[gate.status];
  console.log(`${icon} ${gate.title}: ${gate.status}`);
  for (const check of gate.checks) {
    const mark = { PASS: '✓', FAIL: '✗', WARN: '!', SKIP: '–' }[check.status];
    console.log(`    ${mark} ${check.message}`);
  }
}
mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(
  join(REPORT_DIR, 'report.json'),
  JSON.stringify(
    {
      ranAt: new Date().toISOString(),
      live: LIVE,
      gates: results.map((g) => ({ id: g.id, title: g.title, status: g.status, checks: g.checks })),
    },
    null,
    2,
  ),
);
const failed = results.filter((g) => g.status === 'FAIL');
console.log(
  `\n${failed.length ? '✗ CHẶN' : '✓ ĐẠT'}: ${results.filter((g) => g.status !== 'FAIL').length}/${results.length} cổng đạt. Báo cáo: ${rel(join(REPORT_DIR, 'report.json'))}\n`,
);
process.exit(failed.length ? 1 : 0);
