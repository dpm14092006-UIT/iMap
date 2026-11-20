/* global document, window, WheelEvent, getComputedStyle, requestAnimationFrame */
/** Repeatable UI + real Leaflet integration checks. No paid API calls, writes or real GPS required. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const artifacts = process.env.IMAP_BROWSER_ARTIFACTS;
const errors = [],
  requests = [],
  unexpected = [];
let server, browser;
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
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  // Fixture tiles keep CI independent of map-provider availability. Leaflet itself is never mocked.
  await context.route(/^https?:\/\//, async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (route.request().resourceType() === 'image')
      return route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8XcAAAAASUVORK5CYII=',
          'base64',
        ),
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
    if (r.status() >= 400) console.error('HTTP:', r.status(), r.url());
  });
  await page.goto(`http://127.0.0.1:${address.port}/?demo=1`);
  await page.getByRole('heading', { name: 'Chỉ đường', exact: true }).waitFor();
  await page.locator('.leaflet-tile-loaded').first().waitFor();
  console.log('✓ App shell and Leaflet tile renderer');
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
  assert.equal(await page.locator('#qa-map.map-theme-dark.is-picking').count(), 1);
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
    q.c.setAlgorithmOverlay({
      key: 'qa-algorithm',
      paths: [
        { algorithm: 'astar', points: q.route.legs[0].points },
        { algorithm: 'dijkstra', points: q.route.legs[0].points },
      ],
      coverage: { south: 9.99, west: 105.99, north: 10.02, east: 106.02 },
    });
    q.c.setAlgorithmOverlay(null);
    q.c.destroy();
    const fresh = new q.LeafletMapController(q.el, { onMapClick: () => {} });
    fresh.destroy();
    q.el.remove();
    delete window.__qa;
  });
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  console.log('✓ Mobile route labels, inset fitting, algorithm overlays and destroy/remount lifecycle');
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
  const before = requests.filter((p) => p === '/api/traffic-reports').length;
  // Wait for several real demo GPS timer updates; unit tests cover the full 350-move request budget.
  await page.waitForTimeout(3000);
  const after = requests.filter((p) => p === '/api/traffic-reports').length;
  assert.ok(after - before <= 4, `Traffic fetch storm: ${after - before} requests in 3 seconds`);
  console.log(
    `✓ Browser → HTTP client → route fixture → Demo guidance; traffic requests during GPS: ${after - before}`,
  );
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.getByRole('heading', { name: 'Chỉ đường', exact: true }).waitFor();
  await page
    .getByRole('button', { name: 'Nhiều điểm', exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole('heading', { name: 'Hành trình nhiều điểm' }).waitFor();
  await page
    .getByRole('button', { name: 'Giao thông', exact: true })
    .filter({ visible: true })
    .first()
    .click();
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
    await page.screenshot({ path: resolve(artifacts, 'traffic-mobile-dark.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
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
