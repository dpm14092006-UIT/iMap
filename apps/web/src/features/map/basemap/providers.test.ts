import { describe, expect, it } from 'vitest';
import {
  BASEMAP_PROVIDERS,
  MODE_CHAINS,
  isUsable,
  pickBasemap,
  usableChain,
  usableSourceCredits,
  usable3d,
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

  it('dòng "Nguồn" chỉ ghi đơn vị có nguồn được dùng trong bản build', () => {
    const production = usableSourceCredits(true);
    const approvedPrefixes = new Set(
      BASEMAP_PROVIDERS.filter((p) => isUsable(p, true)).map((p) => p.id.split('-')[0]),
    );
    expect(production).toHaveLength(approvedPrefixes.size);
    expect(production).toContain('vApp (map.vapp.vn)');
    expect(usableSourceCredits(false)).toEqual(['VNSDI', 'vApp (map.vapp.vn)', 'Vietmap']);
  });

  it('3D (địa hình, toà nhà khối) chỉ bật ở production khi đã có phê duyệt riêng', () => {
    const vapp = BASEMAP_PROVIDERS.find((p) => p.id === 'vapp')!;
    expect(usable3d(vapp, false)?.terrainSource).toBe('terrain');
    expect(usable3d(vapp, true)).toBe(vapp.features3d?.approval ? vapp.features3d : null);
    expect(
      usable3d(
        { ...vapp, features3d: { ...vapp.features3d!, approval: { by: 'x', date: 'y', report: 'z' } } },
        true,
      ),
    ).not.toBeNull();
    expect(usable3d(null, false)).toBeNull();
    for (const p of BASEMAP_PROVIDERS)
      if (p.features3d) expect(p.features3d.attribution.length).toBeGreaterThan(0);
  });
});

describe('pickBasemap: vệ tinh chỉ khi phóng gần (production)', () => {
  it('zoom ≥ 10: ảnh Sentinel-2 của VNSDI', () => {
    const pick = pickBasemap('satellite', false, 12, true);
    expect(pick).toMatchObject({ mode: 'satellite', zoomedOut: false });
    expect(pick.chain.map((p) => p.id)).toEqual(['vnsdi-sentinel2']);
  });

  it('thu nhỏ dưới 10: về nền Đường phố vApp (có biên giới), báo zoomedOut để nhắc phóng to', () => {
    const pick = pickBasemap('satellite', false, 6, true);
    expect(pick).toMatchObject({ mode: 'street', zoomedOut: true });
    expect(pick.chain.map((p) => p.id)).toEqual(['vapp']);
  });

  it('bản dev cũng về Đường phố khi thu nhỏ (không rơi sang Vietmap vệ tinh)', () => {
    expect(pickBasemap('satellite', false, 6, false)).toMatchObject({ mode: 'street', zoomedOut: true });
  });

  it('các lớp khác không bị ảnh hưởng bởi zoom', () => {
    expect(pickBasemap('street', false, 3, true)).toMatchObject({ mode: 'street', zoomedOut: false });
  });
});
