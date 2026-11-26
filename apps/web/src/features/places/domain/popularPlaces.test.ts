import { describe, expect, it } from 'vitest';
import { isInVietmapCoverage } from '@routetwin/shared';
import { foldVietnamese } from '../../../shared/text/foldVietnamese';
import { popularPlaces, routablePopularPlaces } from './popularPlaces';

const search = (query: string) =>
  popularPlaces.filter((place) =>
    foldVietnamese(`${place.name} ${place.address} ${place.category}`).includes(foldVietnamese(query)),
  );

describe('popularPlaces', () => {
  it('gõ "Hoàng Sa" hoặc "truong sa" ra quần đảo, ghi rõ của Việt Nam', () => {
    expect(search('Hoàng Sa').map((place) => place.name)).toContain('Quần đảo Hoàng Sa (Việt Nam)');
    expect(search('truong sa').map((place) => place.name)).toContain('Quần đảo Trường Sa (Việt Nam)');
  });

  it('địa chỉ theo địa giới mới: không còn quận/huyện', () => {
    for (const place of popularPlaces) expect(place.address, place.name).not.toMatch(/\b(Quận|Huyện|Q\.)/);
    for (const place of popularPlaces) expect(place.name, place.name).not.toMatch(/\bQ\.\d/);
  });

  it('ô điểm đi/đến không gợi ý quần đảo (không có đường bộ), còn lại đều nằm trong vùng VietMap', () => {
    expect(routablePopularPlaces.some((place) => place.category === 'Quần đảo')).toBe(false);
    expect(routablePopularPlaces.length).toBe(popularPlaces.length - 2);
    for (const place of routablePopularPlaces) expect(isInVietmapCoverage(place), place.name).toBe(true);
  });

  it('mã địa điểm không trùng', () => {
    expect(new Set(popularPlaces.map((place) => place.id)).size).toBe(popularPlaces.length);
  });
});
