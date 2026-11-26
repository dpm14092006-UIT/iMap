import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy, MAP_STYLE_SOURCES, MAP_TILE_SOURCES } from './contentSecurityPolicy';

const directive = (policy: string, name: string) =>
  policy
    .split('; ')
    .find((part) => part.startsWith(`${name} `))
    ?.slice(name.length + 1)
    .split(' ') ?? [];

describe('buildContentSecurityPolicy', () => {
  const policy = buildContentSecurityPolicy({
    apiBaseUrl: 'https://i-map-one.vercel.app/api',
    supabaseUrl: 'https://abc.supabase.co',
  });

  it('chỉ cho chạy script của chính trang, không eval, không plugin', () => {
    expect(directive(policy, 'script-src')).toEqual(["'self'"]);
    expect(directive(policy, 'object-src')).toEqual(["'none'"]);
    expect(policy).not.toContain('unsafe-eval');
  });

  it('cho gọi API và Supabase (cả WebSocket Realtime) theo nguồn, không theo đường dẫn', () => {
    expect(directive(policy, 'connect-src')).toEqual([
      "'self'",
      'https://i-map-one.vercel.app',
      'https://abc.supabase.co',
      'wss://abc.supabase.co',
      'https://map.vapp.vn',
      // MapLibre GL tải ô ảnh VNSDI bằng fetch.
      'https://vnsdi.mae.gov.vn',
    ]);
  });

  it('cho tải ô bản đồ, ảnh xem trước (blob:) và ảnh báo cáo trên Supabase', () => {
    const images = directive(policy, 'img-src');
    for (const source of [...MAP_TILE_SOURCES, 'blob:', 'data:', 'https://abc.supabase.co'])
      expect(images).toContain(source);
  });

  it('API cùng nguồn ("/api") hoặc thiếu cấu hình thì chỉ còn self', () => {
    const local = buildContentSecurityPolicy({ apiBaseUrl: '/api' });
    expect(directive(local, 'connect-src')).toEqual(["'self'", ...MAP_STYLE_SOURCES, ...MAP_TILE_SOURCES]);
    expect(buildContentSecurityPolicy({ apiBaseUrl: 'javascript:alert(1)' })).not.toContain('javascript');
  });

  it('CSP khớp đúng các nguồn bản đồ trong registry, không có OSM/Esri', async () => {
    const { BASEMAP_PROVIDERS } = await import('../../features/map/basemap/providers');
    const origins = (type: string) =>
      [
        ...new Set(
          BASEMAP_PROVIDERS.filter(
            (p) => p.sourceType === type && p.status !== 'REJECTED' && p.status !== 'BLOCKED',
          )
            .filter((p) => p.url.startsWith('https://'))
            .map((p) => new URL(p.url).origin),
        ),
      ].sort();
    expect(origins('arcgis-raster')).toEqual([...MAP_TILE_SOURCES].sort());
    expect(origins('maplibre-style')).toEqual([...MAP_STYLE_SOURCES].sort());
    const vapp = readFileSync(
      new URL('../../features/map/services/maplibre/MaplibreBasemap.ts', import.meta.url),
      'utf8',
    );
    expect(vapp).toContain(`'${MAP_STYLE_SOURCES[0]}'`);
    expect(directive(policy, 'worker-src')).toEqual(["'self'"]);
    expect(policy).not.toMatch(/openstreetmap|opentopomap|arcgisonline|maps\.vietmap\.vn/);
  });
});
