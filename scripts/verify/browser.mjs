/* global document, window, WheelEvent, getComputedStyle, requestAnimationFrame */
/** Repeatable UI + real Leaflet integration checks. No paid API calls, writes or real GPS required. */
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const artifacts = process.env.IMAP_BROWSER_ARTIFACTS;
const fixtureTile = await readFile(resolve(root, 'apps/web/public/favicon-32.png'));
const errors = [],
  requests = [],
  unexpected = [];
/** Mở một chức năng: nút trực tiếp nếu có, nếu không thì qua menu trên cùng (giao diện không còn thanh bên). */
async function openFeature(page, names) {
  for (const name of names) {
    const direct = page.getByRole('button', { name, exact: true }).filter({ visible: true }).first();
    if (await direct.isVisible().catch(() => false)) return direct.click();
  }
  await page.getByRole('button', { name: 'Menu', exact: true }).filter({ visible: true }).first().click();
  for (const name of names) {
    const item = page.getByRole('button', { name, exact: true }).filter({ visible: true }).first();
    if (await item.isVisible().catch(() => false)) return item.click();
  }
  throw new Error(`Không tìm thấy chức năng: ${names.join(' / ')}`);
}

async function openDirections(page) {
  const heading = page.getByRole('heading', { name: 'Chỉ đường', exact: true });
  if (await heading.isVisible().catch(() => false)) return;
  await page
    .getByRole('button', { name: 'Chỉ đường', exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await heading.waitFor();
}

let server, browser;
let limitHybridTiles = false;
let blockSentinel = false;
try {
  process.chdir(resolve(root, 'apps/web'));
  server = await createServer({
    root: resolve(root, 'apps/web'),
    server: { host: '127.0.0.1', port: 5300, strictPort: false },
    optimizeDeps: { force: true },
    logLevel: 'error',
  });
  await server.listen();
  const address = server.httpServer.address();
  assert.equal(typeof address, 'object');
  browser = await chromium.launch({
    headless: true,
    args: ['--enable-unsafe-swiftshader'],
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    permissions: ['geolocation'],
    geolocation: { latitude: 10.77, longitude: 106.69, accuracy: 5 },
  });
  // Fixture tiles keep CI independent of map-provider availability. Leaflet itself is never mocked.
  await context.route(/^https?:\/\//, async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (blockSentinel && url.pathname.includes('/Sentinel2/')) return route.fulfill({ status: 503 });
    if (route.request().resourceType() === 'image')
      return route.fulfill({
        contentType: 'image/png',
        body: fixtureTile,
      });
    return route.abort();
  });
  const start = {
    id: 'qa-start',
    name: 'QA Origin',
    address: 'Test district',
    lat: 10.77,
    lng: 106.69,
    source: 'vietmap',
  };
  const end = { ...start, id: 'qa-end', name: 'QA Destination', lat: 10.79, lng: 106.71 };
  const routeResult = {
    source: 'vietmap',
    distanceMeters: 3500,
    durationSeconds: 600,
    coordinates: Array.from({ length: 101 }, (_, i) => [
      start.lng + ((end.lng - start.lng) * i) / 100,
      start.lat + ((end.lat - start.lat) * i) / 100,
    ]),
    instructions: [],
  };
  await context.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    requests.push(url.pathname);
    const style = /\/map\/vietmap\/styles\/(tm|dm|hm)\/style\.json$/.exec(url.pathname)?.[1];
    if (style) {
      return route.fulfill({
        json: {
          version: 8,
          sources: {
            fixture: {
              type: 'raster',
              tiles: [`https://maps.vietmap.vn/maps/tiles/st/{z}/{x}/{y}.png?fixture=${style}`],
              tileSize: 256,
            },
          },
          layers: [
            {
              id: 'background',
              type: 'background',
              paint: {
                'background-color': style === 'dm' ? '#101a29' : '#e8ece7',
              },
            },
            { id: 'fixture', type: 'raster', source: 'fixture' },
          ],
        },
      });
    }
    if (url.pathname.startsWith('/api/map/vnsdi/'))
      return route.fulfill({ contentType: 'image/png', body: fixtureTile });
    if (url.pathname.startsWith('/api/map/vietmap/tiles/st/')) {
      if (limitHybridTiles && url.searchParams.get('fixture') === 'hm') return route.fulfill({ status: 423 });
      return route.fulfill({ contentType: 'image/png', body: fixtureTile });
    }
    let data;
    if (url.pathname === '/api/push/config') data = { enabled: false, publicKey: null };
    else if (url.pathname === '/api/health') data = { configured: {} };
    else if (url.pathname === '/api/traffic-reports') data = [];
    else if (url.pathname === '/api/places/suggest')
      data = [url.searchParams.get('q')?.includes('Destination') ? end : start];
    else if (url.pathname === '/api/places/reverse') data = null;
    else if (url.pathname === '/api/routes/calculate') data = routeResult;
    else if (url.pathname === '/api/places/nearby') data = [];
    else if (url.pathname === '/api/pathfinding/coverage') data = null;
    else {
      unexpected.push(url.pathname);
      return route.fulfill({
        status: 503,
        json: { error: { code: 'QA_UNEXPECTED', message: 'Unexpected fixture request' } },
      });
    }
    return route.fulfill({ json: { data } });
  });
  await context.addInitScript(() => window.localStorage.setItem('imap.demoMode', '1'));
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error('PAGE ERROR:', error.stack);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource:')) errors.push(msg.text());
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !(r.status() === 423 && r.url().includes('fixture=hm')))
      console.error('HTTP:', r.status(), r.url());
  });
  const initialMapTile = page.waitForResponse((r) => r.ok() && r.url().includes('/api/map/vietmap/tiles/'));
  await page.goto(`http://127.0.0.1:${address.port}/?demo=1`);
  // Trang chủ chỉ có bản đồ + thanh tìm kiếm; bảng Chỉ đường mở khi bấm nút trên thanh trên cùng.
  await openDirections(page);
  await initialMapTile;
  await page.locator('.leaflet-gl-layer .maplibregl-canvas').first().waitFor();
  assert.ok(
    requests.includes('/api/map/vietmap/styles/tm/style.json') ||
      requests.includes('/api/map/vietmap/styles/dm/style.json'),
  );
  assert.equal(await page.getByRole('button', { name: 'Demo', exact: true }).count(), 0);
  assert.equal(await page.getByText('So sánh thuật toán', { exact: true }).count(), 0);
  console.log('✓ Legacy demo URL/storage cannot enable removed UI; app and Leaflet render');
  await page.evaluate(async () => {
    const { LeafletMapController } = await import('/src/features/map/services/LeafletMapController.ts');
    const { routePlan } = await import('/src/testing/fixtures.ts');
    const { toTrafficMapLayer } = await import('/src/features/traffic/domain/trafficMapLayer.ts');
    const el = document.createElement('div');
    el.id = 'qa-map';
    el.className = 'routetwin-leaflet';
    el.style.cssText = 'position:fixed;inset:0;z-index:10000';
    document.body.append(el);
    const events = { bounds: 0, clicks: 0, selected: [], pois: [], gestures: 0 };
    const c = new LeafletMapController(el, {
      onBoundsChange: () => events.bounds++,
      onMapClick: () => events.clicks++,
      onSelectRoute: (id) => events.selected.push(id),
      onPoiClick: (id) => events.pois.push(id),
    });
    const route = routePlan();
    const data = {
      language: 'vi',
      layer: 'street',
      route,
      routeOptions: [],
      draftStops: { origin: null, destination: null },
      trafficLayer: toTrafficMapLayer([]),
      currentLocation: null,
      headingDegrees: null,
      isNavigating: false,
      isPicking: false,
      overlays: { traffic: true, incidents: true, terrain: false },
      pois: [],
      highlightedPoiId: null,
    };
    c.update(data);
    window.__qa = { c, data, route, events, el, LeafletMapController, toTrafficMapLayer };
  });
  await page.waitForFunction(() => window.__qa.c.getZoom() > 5);
  assert.equal(await page.locator('#qa-map .routetwin-route-label').count(), 1);
  await page.locator('#qa-map .routetwin-route-label').click();
  assert.deepEqual(await page.evaluate(() => window.__qa.events.selected), ['route-a']);
  console.log('✓ Route without alternatives fits, draws and dispatches selection');
  const darkStyle = page.waitForResponse((r) => r.ok() && r.url().includes('/map/vietmap/styles/dm/'));
  await page.evaluate(() => {
    const q = window.__qa;
    q.data.layer = 'dark';
    q.data.isPicking = true;
    q.data.isNavigating = true;
    q.data.currentLocation = { lat: 10, lng: 106 };
    q.data.headingDegrees = 90;
    q.data.draftStops.focus = { ...q.route.stops[0], name: '<script>bad()</script>' };
    q.data.pois = [
      {
        id: 'poi',
        name: 'QA Cafe',
        address: '',
        category: 'cafe',
        categoryCodes: [],
        lat: 10.003,
        lng: 106.003,
        distanceFromRouteM: 0,
        positionAlongRouteM: 0,
        detourMin: 0,
      },
    ];
    q.data.highlightedPoiId = 'poi';
    const report = {
      id: 'report',
      lat: 10.007,
      lng: 106.007,
      incidentType: 'flood',
      severity: 'high',
      vehicleScope: 'both',
      title: 'QA Flood',
      communityReporterCount: 3,
    };
    q.data.trafficLayer = q.toTrafficMapLayer([report, { ...report, id: 'cleared', status: 'cleared' }]);
    q.c.update(q.data);
  });
  await darkStyle;
  assert.equal(await page.locator('#qa-map.map-theme-dark.is-picking').count(), 1);
  await page.locator('#qa-map .maplibregl-canvas').waitFor();
  assert.equal(await page.locator('#qa-map .routetwin-navigation-marker').count(), 1);
  assert.equal(await page.locator('#qa-map .routetwin-route-label').count(), 0);
  assert.equal(await page.locator('#qa-map .routetwin-poi-marker.is-highlighted').count(), 1);
  assert.equal(await page.locator('#qa-map .routetwin-incident-marker').count(), 1);
  assert.equal(
    await page
      .locator('#qa-map .routetwin-navigation-marker')
      .evaluate((el) => el.style.getPropertyValue('--heading-degrees')),
    '90deg',
  );
  await page.locator('#qa-map .routetwin-poi-marker').click();
  assert.deepEqual(await page.evaluate(() => window.__qa.events.pois), ['poi']);
  await page.locator('#qa-map .routetwin-incident-marker').click();
  await page.waitForFunction(() =>
    document.querySelector('#qa-map .leaflet-popup-content')?.textContent?.includes('QA Flood'),
  );
  assert.match(await page.locator('#qa-map .leaflet-popup-content').textContent(), /QA Flood/);
  console.log('✓ GPS arrow, heading, POI selection, focus pin, active incident popup and independent layers');
  const sentinelTile = page.waitForResponse((r) => r.ok() && r.url().includes('/Sentinel2/MapServer/tile/'));
  await page.evaluate(() => {
    const q = window.__qa;
    q.data.overlays = { traffic: false, incidents: false, terrain: true };
    q.data.currentLocation = null;
    q.data.pois = [];
    q.data.draftStops.focus = null;
    q.data.isPicking = false;
    q.data.layer = 'satellite';
    q.c.update(q.data);
    const off = q.c.onUserGesture(() => q.events.gestures++);
    q.el.dispatchEvent(new WheelEvent('wheel'));
    off();
    q.el.dispatchEvent(new WheelEvent('wheel'));
  });
  assert.equal(await page.locator('#qa-map .routetwin-incident-marker').count(), 0);
  assert.equal(await page.locator('#qa-map .routetwin-poi-marker').count(), 0);
  assert.equal(await page.locator('#qa-map .routetwin-navigation-marker').count(), 0);
  assert.equal(await page.evaluate(() => window.__qa.events.gestures), 1);
  // Vệ tinh: ảnh Sentinel-2 của VNSDI (không nhãn) → nhãn chủ quyền của iMap phải hiện.
  await sentinelTile;
  await page.locator('#qa-map.map-theme-satellite .leaflet-tile-loaded').first().waitFor();
  assert.equal(await page.evaluate(() => window.__qa.el.dataset.basemap), 'vnsdi-sentinel2');
  assert.match(await page.locator('#qa-map .leaflet-control-attribution').textContent(), /VNSDI.*Sentinel-2/);
  assert.equal(await page.locator('#qa-map .sovereignty-label--archipelago').count(), 2);
  // Đường phố + Địa hình khi VNSDI địa hình chưa có token: giữ nền đường phố, không để bản đồ trắng.
  await page.evaluate(() => {
    const q = window.__qa;
    q.data.layer = 'street';
    q.c.update(q.data);
  });
  await page.waitForFunction(() => window.__qa.el.dataset.basemap === 'vietmap');
  assert.equal(await page.locator('#qa-map .routetwin-basemap-notice').count(), 0);
  assert.ok(!requests.some((p) => p.startsWith('/api/map/vnsdi/terrain/')));
  // Sentinel-2 lỗi → Vietmap hybrid.
  blockSentinel = true;
  const hybridTile = page.waitForResponse((r) => r.ok() && r.url().includes('fixture=hm'));
  await page.evaluate(() => {
    const q = window.__qa;
    // Sang vùng khác để trình duyệt phải tải ô Sentinel-2 mới (ô cũ nằm trong bộ nhớ đệm).
    q.c.map.setView([21.03, 105.85], 9, { animate: false });
    q.data.layer = 'satellite';
    q.c.update(q.data);
  });
  await hybridTile;
  await page.locator('#qa-map.map-theme-satellite .maplibregl-canvas').waitFor();
  assert.equal(await page.evaluate(() => window.__qa.el.dataset.basemap), 'vietmap');
  assert.ok(requests.includes('/api/map/vietmap/styles/hm/style.json'));
  // Hết nguồn hợp lệ (Vietmap 423) → thông báo, không dự phòng về OSM.
  await page.evaluate(() => {
    const q = window.__qa;
    q.data.layer = 'street';
    q.c.update(q.data);
  });
  limitHybridTiles = true;
  const blockedTile = page.waitForResponse((r) => r.status() === 423 && r.url().includes('fixture=hm'));
  await page.evaluate(() => {
    const q = window.__qa;
    q.data.layer = 'satellite';
    q.c.update(q.data);
  });
  await blockedTile;
  await page.locator('#qa-map .routetwin-basemap-notice').waitFor();
  assert.equal(await page.locator('#qa-map .maplibregl-canvas').count(), 0);
  assert.equal(await page.locator('#qa-map .sovereignty-label--archipelago').count(), 2);
  console.log(
    '✓ Satellite uses VNSDI Sentinel-2, falls back to Vietmap hybrid, then shows a notice (never OSM); terrain without a source keeps the base',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    const q = window.__qa;
    q.c.invalidateSize();
    q.c.setFitInsets({ left: 0, bottom: 330 });
    q.data.isNavigating = false;
    q.data.language = 'en';
    q.c.update(q.data);
    q.c.refit();
  });
  assert.equal(await page.locator('#qa-map .routetwin-route-label.is-compact').count(), 1);
  assert.match(await page.locator('#qa-map .routetwin-route-label').innerText(), /min/);
  await page.evaluate(() => {
    const q = window.__qa;
    q.c.destroy();
    const fresh = new q.LeafletMapController(q.el, { onMapClick: () => {} });
    fresh.destroy();
    q.el.remove();
    delete window.__qa;
  });
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  console.log('✓ Mobile route labels, inset fitting and destroy/remount lifecycle');
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [label, value] of [
    ['Điểm xuất phát', 'QA Origin'],
    ['Điểm đến', 'QA Destination'],
  ]) {
    const input = page.getByRole('combobox', { name: label, exact: true });
    await input.fill(value);
    await page.getByRole('option').filter({ hasText: value }).first().click();
  }
  await page.getByRole('button', { name: 'Tìm đường', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu', exact: true }).waitFor();
  assert.equal(await page.locator('.routetwin-route-label').count(), 1);
  await page.getByRole('button', { name: 'Tùy chọn', exact: true }).click();
  await page.getByRole('button', { name: 'Tùy chọn', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu', exact: true }).click();
  await page.getByRole('region', { name: 'Điều hướng chuyến đi' }).waitFor();
  await page.locator('.routetwin-navigation-marker').waitFor();
  // Bản đồ phụ (Điều 20) phải nhìn thấy đủ: không bị đồng hồ tốc độ hay thanh dẫn đường che.
  await page.waitForTimeout(1200);
  const insetBlocked = await page.evaluate(() => {
    const inset = document.querySelector('.routetwin-territory-inset');
    if (!inset || inset.hidden) return null;
    const a = inset.getBoundingClientRect();
    return [...document.querySelectorAll('.speedometer, [data-nav-banner]')]
      .map((el) => ({
        name: el.className.toString().split(' ')[0] || 'banner',
        r: el.getBoundingClientRect(),
      }))
      .filter(
        ({ r }) =>
          Math.min(a.right, r.right) > Math.max(a.left, r.left) &&
          Math.min(a.bottom, r.bottom) > Math.max(a.top, r.top),
      )
      .map(({ name }) => name);
  });
  assert.ok(
    !insetBlocked || insetBlocked.length === 0,
    `Territory inset is covered by: ${JSON.stringify(insetBlocked)}`,
  );
  const before = requests.filter((p) => p === '/api/traffic-reports').length;
  assert.match(await page.getByRole('region', { name: 'Điều hướng chuyến đi' }).innerText(), /GPS trực tiếp/);
  assert.equal(await page.getByRole('button', { name: /Rẽ nhầm|Tạm dừng|Sự cố phía trước/ }).count(), 0);
  for (const viewport of [
    { width: 1440, height: 708 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    const trigger = page.getByRole('button', { name: 'Lớp bản đồ', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Lớp bản đồ' });
    await dialog.getByRole('button', { name: 'Vệ tinh', exact: true }).click();
    assert.equal(
      await dialog.getByRole('button', { name: 'Vệ tinh', exact: true }).getAttribute('aria-pressed'),
      'true',
    );
    // Menu không được chồng lên thanh dẫn đường (thanh nằm trên lớp của menu và che mất công tắc).
    const overlap = await page.evaluate(() => {
      const menu = document
        .querySelector('[role="dialog"][aria-label="Lớp bản đồ"]')
        ?.getBoundingClientRect();
      const banner = document.querySelector('[data-nav-banner]')?.getBoundingClientRect();
      if (!menu || !banner) return null;
      const w = Math.min(menu.right, banner.right) - Math.max(menu.left, banner.left);
      const h = Math.min(menu.bottom, banner.bottom) - Math.max(menu.top, banner.top);
      return w > 0 && h > 0 ? { menu: menu.toJSON(), banner: banner.toJSON() } : null;
    });
    assert.equal(
      overlap,
      null,
      `Map layer popover overlaps the navigation banner at ${viewport.width}×${viewport.height}: ${JSON.stringify(overlap)}`,
    );
    const box = await dialog.boundingBox();
    assert.ok(
      box &&
        box.x >= 0 &&
        box.x + box.width <= viewport.width &&
        box.y >= 0 &&
        box.y + box.height <= viewport.height,
      `Map layer popover is clipped at ${viewport.width}×${viewport.height}: ${JSON.stringify(box)}`,
    );
    const incidents = dialog.getByRole('switch', { name: 'Sự cố cộng đồng' });
    const wasChecked = await incidents.getAttribute('aria-checked');
    await incidents.click();
    assert.notEqual(await incidents.getAttribute('aria-checked'), wasChecked);
    await incidents.click();
    await dialog.getByRole('button', { name: 'Đường phố', exact: true }).click();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  console.log('✓ Navigation layer popover stays in view and its controls work on desktop and mobile');
  // Drive the browser's native Geolocation API, never a simulation in application code.
  for (let i = 1; i <= 4; i++) {
    await context.setGeolocation({
      latitude: 10.77 + i * 0.00001,
      longitude: 106.69 + i * 0.00001,
      accuracy: 5,
    });
    await page.waitForTimeout(180);
  }
  const after = requests.filter((p) => p === '/api/traffic-reports').length;
  assert.ok(after - before <= 4, `Traffic fetch storm: ${after - before} requests for four GPS fixes`);
  console.log(
    `✓ Browser → HTTP client → route fixture → native GPS guidance; traffic requests during GPS: ${after - before}`,
  );
  await context.setGeolocation({ latitude: 10.78, longitude: 106.69, accuracy: 5 });
  const trip = page.getByRole('region', { name: 'Điều hướng chuyến đi' });
  const stop = trip.getByRole('button', { name: /^Kết thúc/ });
  await trip.getByRole('button', { name: 'Tính lại tuyến' }).waitFor();
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 650 });
    await trip.getByRole('button', { name: 'Báo cáo' }).waitFor();
    await trip.getByRole('button', { name: /^(Toàn tuyến|Về vị trí)$/ }).waitFor();
    // Đo lại cho tới khi bố cục ổn định (tối đa 2 giây): giao diện sắp xếp lại sau khi đổi kích thước.
    let layout;
    for (let attempt = 0; attempt < 10; attempt++) {
      layout = await stop.evaluate((button) => {
        const banner = button.closest('section').getBoundingClientRect();
        const actions = [...button.parentElement.querySelectorAll('button')].map((action) =>
          action.getBoundingClientRect(),
        );
        return {
          fits: actions.every((action) => action.left >= banner.left && action.right <= banner.right),
          rows: new Set(actions.map((action) => Math.round(action.top))).size,
          count: actions.length,
        };
      });
      if (layout.rows === 1 && layout.fits) break;
      await page.waitForTimeout(200);
    }
    const { fits, rows, count } = layout;
    assert.deepEqual(
      { fits, rows, count },
      { fits: true, rows: 1, count: 4 },
      `Off-route actions at ${width}px`,
    );
  }
  await stop.click();
  await trip.waitFor({ state: 'hidden' });
  await context.setGeolocation({ latitude: 10.77, longitude: 106.69, accuracy: 5 });
  await page.setViewportSize({ width: 1440, height: 1000 });
  console.log('✓ Off-route actions fit narrow mobile and desktop banners, and the stop button works');
  await page.goto(`http://127.0.0.1:${address.port}/`);
  // Trang chủ chỉ có bản đồ + thanh tìm kiếm; bảng Chỉ đường mở khi bấm nút trên thanh trên cùng.
  await openDirections(page);
  await openFeature(page, ['Nhiều điểm', 'Lộ trình nhiều điểm']);
  await page.getByRole('heading', { name: 'Hành trình nhiều điểm' }).waitFor();
  await openFeature(page, ['Giao thông']);
  await page.getByRole('heading', { name: 'Tình hình giao thông' }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  const colour = await page.evaluate(() => {
    const el = document.createElement('button');
    el.className = 'ui-button ui-button-secondary';
    el.style.transition = 'none';
    document.body.append(el);
    document.documentElement.classList.remove('dark');
    const light = getComputedStyle(el).backgroundColor;
    document.documentElement.classList.add('dark');
    const dark = getComputedStyle(el).backgroundColor;
    el.remove();
    return { light, dark };
  });
  assert.notEqual(colour.light, colour.dark);
  console.log('✓ Split panels mount, mobile has no horizontal overflow, semantic tokens switch themes');
  if (artifacts) {
    await mkdir(artifacts, { recursive: true });
    await page.waitForTimeout(200);
    await page.screenshot({ path: resolve(artifacts, 'traffic-mobile-dark.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: resolve(artifacts, 'traffic-desktop-dark.png'), fullPage: true });
  }
  assert.deepEqual(errors, [], `Browser errors: ${errors.join('; ')}`);
  assert.deepEqual(unexpected, [], `Unmocked API endpoints: ${unexpected.join(', ')}`);
  console.log('All browser checks passed.');
} catch (error) {
  console.error({ errors, unexpected });
  throw error;
} finally {
  await browser?.close();
  await server?.close();
}
