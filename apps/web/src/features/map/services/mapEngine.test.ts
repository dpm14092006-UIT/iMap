import { describe, expect, it } from 'vitest';
import { resolveMapEngine } from './mapEngine';

describe('resolveMapEngine', () => {
  it('mặc định Leaflet; ?engine= ghi đè cấu hình build', () => {
    expect(resolveMapEngine('', undefined)).toBe('leaflet');
    expect(resolveMapEngine('', 'maplibre')).toBe('maplibre');
    expect(resolveMapEngine('?engine=maplibre', undefined)).toBe('maplibre');
    expect(resolveMapEngine('?engine=leaflet', 'maplibre')).toBe('leaflet');
  });

  it('giá trị lạ không đổi bộ máy', () => {
    expect(resolveMapEngine('?engine=webgpu', undefined)).toBe('leaflet');
    expect(resolveMapEngine('', 'cesium')).toBe('leaflet');
  });
});
