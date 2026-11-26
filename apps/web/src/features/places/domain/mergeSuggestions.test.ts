import { describe, expect, it } from 'vitest';
import type { PlaceSearchSuggestion } from '../types';
import { mergeSuggestions } from './mergeSuggestions';
import { popularPlaces } from './popularPlaces';

const remote = (name: string, address = 'TP.HCM'): PlaceSearchSuggestion => ({
  id: `vm:${name}`,
  name,
  address,
  category: '',
  source: 'vietmap',
});

describe('mergeSuggestions', () => {
  it('"Hoàng Sa": quần đảo vẫn đứng đầu sau khi 10 kết quả VietMap về', () => {
    const vietmap = Array.from({ length: 10 }, (_, index) => remote(`Hoàng Sa Shop ${index}`));
    const merged = mergeSuggestions('Hoàng Sa', popularPlaces, vietmap, 7);
    expect(merged[0]!.name).toBe('Quần đảo Hoàng Sa (Việt Nam)');
    expect(merged).toHaveLength(7);
  });

  it('khớp chỉ theo địa chỉ/loại thì xếp sau kết quả VietMap', () => {
    const merged = mergeSuggestions('Phường Sài Gòn', popularPlaces, [remote('Phường Sài Gòn')], 20);
    expect(merged[0]!.source).toBe('vietmap');
    expect(merged.length).toBeGreaterThan(1);
  });

  it('bỏ trùng giữa gợi ý có sẵn và kết quả VietMap cùng tên + địa chỉ', () => {
    const duplicate = remote('Chợ Bến Thành', 'Phường Bến Thành');
    const merged = mergeSuggestions('Chợ Bến Thành', popularPlaces, [duplicate], 10);
    expect(merged.filter((place) => place.name === 'Chợ Bến Thành')).toHaveLength(1);
  });

  it('gõ không dấu vẫn khớp', () => {
    expect(mergeSuggestions('truong sa', popularPlaces, [], 5)[0]!.name).toBe(
      'Quần đảo Trường Sa (Việt Nam)',
    );
  });
});
