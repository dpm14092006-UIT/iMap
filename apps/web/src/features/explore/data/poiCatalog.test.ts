import { describe, expect, it } from 'vitest';
import { findPoiCategory, termFromText } from './poiCatalog';

describe('termFromText', () => {
  it('khớp nguyên cụm danh mục (không dấu, hoa thường) thì gửi category', () => {
    expect(termFromText('Xăng')).toEqual({ category: 'fuel' });
    expect(termFromText('  cà  phê ')).toEqual({ category: 'cafe' });
    expect(termFromText('tram sac xe dien')).toEqual({ category: 'ev' });
    expect(termFromText('ATM')).toEqual({ category: 'atm' });
  });
  it('mọi từ khác gửi nguyên văn, kể cả khi chứa tên danh mục', () => {
    expect(termFromText('phở')).toEqual({ query: 'phở' });
    expect(termFromText('sửa xe')).toEqual({ query: 'sửa xe' });
    expect(termFromText('Highlands')).toEqual({ query: 'Highlands' });
    expect(termFromText('cà phê muối')).toEqual({ query: 'cà phê muối' });
  });
  it('chuỗi rỗng không tạo điều kiện tìm', () => {
    expect(termFromText('   ')).toBeNull();
    expect(findPoiCategory('')).toBeNull();
  });
});
