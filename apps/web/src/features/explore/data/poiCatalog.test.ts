import { describe, expect, it } from 'vitest';
import type { PoiCategory } from '../types';
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

const catalogAliases: { category: PoiCategory; alias: string }[] = [
  { category: 'restaurant', alias: 'Nhà hàng' },
  { category: 'restaurant', alias: 'nha hang' },
  { category: 'restaurant', alias: 'quán ăn' },
  { category: 'restaurant', alias: 'ăn uống' },
  { category: 'cafe', alias: 'cà phê' },
  { category: 'cafe', alias: 'ca phe' },
  { category: 'cafe', alias: 'cafe' },
  { category: 'cafe', alias: 'coffee' },
  { category: 'hotel', alias: 'khách sạn' },
  { category: 'hotel', alias: 'khach san' },
  { category: 'hotel', alias: 'hotel' },
  { category: 'hotel', alias: 'nhà nghỉ' },
  { category: 'attraction', alias: 'điểm tham quan' },
  { category: 'attraction', alias: 'tham quan' },
  { category: 'attraction', alias: 'du lịch' },
  { category: 'attraction', alias: 'công viên' },
  { category: 'museum', alias: 'bảo tàng' },
  { category: 'museum', alias: 'bao tang' },
  { category: 'museum', alias: 'museum' },
  { category: 'bus', alias: 'trạm xe buýt' },
  { category: 'bus', alias: 'tram xe buyt' },
  { category: 'bus', alias: 'xe buyt' },
  { category: 'bus', alias: 'bus' },
  { category: 'pharmacy', alias: 'nhà thuốc' },
  { category: 'pharmacy', alias: 'nha thuoc' },
  { category: 'pharmacy', alias: 'pharmacy' },
  { category: 'atm', alias: 'ATM' },
  { category: 'atm', alias: 'cây ATM' },
  { category: 'fuel', alias: 'xăng' },
  { category: 'fuel', alias: 'trạm xăng' },
  { category: 'fuel', alias: 'cây xăng' },
  { category: 'fuel', alias: 'đổ xăng' },
  { category: 'ev', alias: 'sạc xe điện' },
];

const aliasScenarios = catalogAliases.flatMap(({ category, alias }) => [
  { category, query: alias },
  { category, query: ` ${alias.toUpperCase()} ` },
  { category, query: `\t${alias.normalize('NFD')}\n` },
]);

describe('POI alias regression matrix', () => {
  it.each(aliasScenarios)('recognizes $query as $category', ({ category, query }) => {
    expect(termFromText(query)).toEqual({ category });
  });
});
