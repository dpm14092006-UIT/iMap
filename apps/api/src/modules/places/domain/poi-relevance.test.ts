import { describe, expect, it } from 'vitest';
import { foldCase, matchesQueryName } from './poi-relevance.js';

describe('matchesQueryName', () => {
  it('"phở" giữ tên có phở, bỏ "phố" và tên không liên quan', () => {
    expect(matchesQueryName('Phở Gà Phố Cổ', 'phở')).toBe(true);
    expect(matchesQueryName('Kim Kê Phở', 'phở')).toBe(true);
    expect(matchesQueryName('The American School', 'phở')).toBe(false);
    expect(matchesQueryName('Cafe Phố Mới', 'phở')).toBe(false);
  });

  it('"pho" không dấu khớp cả phở và phố', () => {
    expect(matchesQueryName('Phở Gà Phố Cổ', 'pho')).toBe(true);
    expect(matchesQueryName('Cafe Phố Mới', 'pho')).toBe(true);
    expect(matchesQueryName('The American School', 'pho')).toBe(false);
  });

  it('nhiều từ: mọi từ phải có trong tên', () => {
    expect(matchesQueryName('Cà Phê Muối Chú Long', 'cà phê muối')).toBe(true);
    expect(matchesQueryName('Cà Phê Sữa', 'cà phê muối')).toBe(false);
    expect(matchesQueryName('Muối Cà Phê', 'cà phê muối')).toBe(true);
    expect(matchesQueryName('Ca Phe Muoi', 'cà phê muối')).toBe(false);
  });

  it('chuẩn hóa hoa/thường, khoảng trắng và dạng Unicode tổ hợp (NFD)', () => {
    expect(matchesQueryName('PHỞ BÒ', '  Phở   ')).toBe(true);
    expect(matchesQueryName('Phở Bò', 'pho\u031b\u0309')).toBe(true); // ở dạng tổ hợp NFD
    expect(foldCase('  Phở  BÒ ')).toBe('phở bò');
  });

  it('đ ↔ d khi truy vấn không dấu; truy vấn rỗng luôn khớp', () => {
    expect(matchesQueryName('Đồng Quê', 'dong')).toBe(true);
    expect(matchesQueryName('Bất kỳ', '   ')).toBe(true);
  });
});
