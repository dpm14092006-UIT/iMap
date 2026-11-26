import { describe, expect, it } from 'vitest';
import {
  BASEMAP_PROVIDERS,
  MODE_CHAINS,
  isUsable,
  usableChain,
  type BasemapMode,
  type BasemapProvider,
} from './providers';

const modes = Object.keys(MODE_CHAINS) as BasemapMode[];

describe('BasemapRegistry', () => {
  it('mỗi nguồn có đủ trường kiểm chứng và id không trùng', () => {
    const ids = BASEMAP_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of BASEMAP_PROVIDERS) {
      expect(p.name && p.attribution && p.license && p.dataSource && p.version, p.id).toBeTruthy();
      expect(p.lastVerified, p.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.evidence.length, p.id).toBeGreaterThan(0);
      if (p.status === 'APPROVED') expect(p.approval, `${p.id} APPROVED phải có người duyệt`).toBeDefined();
      else expect(p.blockers.length, `${p.id} chưa APPROVED phải ghi rõ điều còn thiếu`).toBeGreaterThan(0);
    }
  });

  it('production chỉ dùng nguồn APPROVED có người duyệt', () => {
    for (const mode of modes)
      for (const p of usableChain(mode, true)) {
        expect(p.status).toBe('APPROVED');
        expect(p.approval).toBeDefined();
      }
    const unsigned: BasemapProvider = { ...BASEMAP_PROVIDERS[0]!, status: 'APPROVED', approval: undefined };
    expect(isUsable(unsigned, true)).toBe(false);
  });

  it('không bao giờ dùng OpenStreetMap nguyên bản hay nguồn bị chặn, kể cả ở dev', () => {
    for (const mode of modes)
      for (const p of usableChain(mode, false)) {
        expect(['APPROVED', 'TESTING']).toContain(p.status);
        expect(p.id).not.toMatch(/^osm/);
      }
    expect(BASEMAP_PROVIDERS.find((p) => p.id === 'osm-standard')?.status).toBe('REJECTED');
  });

  it('chuỗi dự phòng chỉ chứa nguồn hỗ trợ đúng chế độ', () => {
    for (const mode of modes) for (const p of usableChain(mode, false)) expect(p.modes).toContain(mode);
    expect(usableChain('street', false).map((p) => p.id)).toEqual(['vapp', 'vietmap']);
    expect(usableChain('satellite', false)[0]?.id).toBe('vnsdi-sentinel2');
  });
});
