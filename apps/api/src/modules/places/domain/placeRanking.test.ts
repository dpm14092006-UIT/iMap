import { describe, expect, it } from 'vitest';
import { landmarkAlias, nameMatch, placeKindScore, rankPlaceSuggestions } from './placeRanking.js';

const row = (name: string, address = 'Hoàn Kiếm, Hà Nội') => ({ name, address });

describe('landmarkAlias', () => {
  it.each([
    ['Hồ Gươm', 'Hồ Hoàn Kiếm'],
    ['ho guom', 'Hồ Hoàn Kiếm'],
    ['  HỒ   GƯƠM ', 'Hồ Hoàn Kiếm'],
    ['Lăng Bác', 'Lăng Chủ tịch Hồ Chí Minh'],
    ['nha tho duc ba', 'Nhà thờ Đức Bà Sài Gòn'],
  ])('%j → %j', (query, canonical) => expect(landmarkAlias(query)).toBe(canonical));

  it('không đổi khi đã gõ đúng tên chuẩn hoặc không phải bí danh', () => {
    expect(landmarkAlias('Hồ Hoàn Kiếm')).toBeUndefined();
    expect(landmarkAlias('Dinh Độc Lập')).toBeUndefined();
    expect(landmarkAlias('Hồ Gươm Plaza')).toBeUndefined();
    expect(landmarkAlias('phở')).toBeUndefined();
  });
});

describe('placeKindScore', () => {
  it('địa danh +1, doanh nghiệp −1', () => {
    expect(placeKindScore('Hồ Hoàn Kiếm')).toBe(1);
    expect(placeKindScore('Phố Đi Bộ Hồ Gươm')).toBe(1);
    expect(placeKindScore('Chợ Bến Thành')).toBe(1);
    expect(placeKindScore('Công Ty Liên Doanh Du Lịch Hồ Gươm')).toBe(-1);
    expect(placeKindScore('Trung Tâm Thương Mại Hồ Gươm Plaza')).toBe(-1);
    expect(placeKindScore('Phòng Kinh Doanh Xuất Nhập Khẩu Hồ Gươm Audio')).toBe(-1);
    expect(placeKindScore('Trà Đá Hồ Gươm')).toBe(0);
  });
  it('không nhầm từ ghép: "Hồng" không phải "Hồ"', () => {
    expect(placeKindScore('Hồng Hà Café')).toBe(0);
    expect(placeKindScore('Đền Ngọc Sơn')).toBe(1);
  });
});

describe('nameMatch', () => {
  it('khớp hẳn > tên + khu vực > tên bắt đầu bằng câu gõ', () => {
    expect(nameMatch('Cau Rong', 'Cầu Rồng')).toBe(3);
    expect(nameMatch('Cau Rong Da Nang', 'Cầu Rồng')).toBe(2);
    expect(nameMatch('Cau Rong', 'Cầu Rồng Đà Nẵng')).toBe(1);
    expect(nameMatch('Cau Rong', 'Hạt Giống Cầu Rồng')).toBe(0);
  });
});

describe('rankPlaceSuggestions', () => {
  it('"Hồ Gươm": chính cái hồ (từ tên chuẩn) lên đầu, địa danh trước doanh nghiệp', () => {
    const ranked = rankPlaceSuggestions(
      'Hồ Gươm',
      [
        row('Hồ Hoàn Kiếm'),
        row('Trung Tâm Thương Mại Hồ Gươm Plaza'),
        row('Phố Đi Bộ Hồ Gươm'),
        row('Trà Đá Hồ Gươm'),
        row('Công Ty Liên Doanh Du Lịch Hồ Gươm Diethelm'),
      ],
      'Hồ Hoàn Kiếm',
    ).map(({ name }) => name);
    expect(ranked).toEqual([
      'Hồ Hoàn Kiếm',
      'Phố Đi Bộ Hồ Gươm',
      'Trà Đá Hồ Gươm',
      'Trung Tâm Thương Mại Hồ Gươm Plaza',
      'Công Ty Liên Doanh Du Lịch Hồ Gươm Diethelm',
    ]);
  });

  it('bỏ dòng trùng tên và địa chỉ (kể cả khác dấu, khoảng trắng)', () => {
    const ranked = rankPlaceSuggestions('cho ben thanh', [
      row('Chợ Bến Thành', 'Phường Bến Thành, Quận 1'),
      row('Chợ  Bến Thành', 'Phường Bến Thành,  Quận 1'),
      row('Chợ Bến Thành', 'Quận 3'),
    ]);
    expect(ranked).toHaveLength(2);
  });

  it('cùng mức thì giữ thứ tự VietMap (đã ưu tiên gần vị trí)', () => {
    const rows = [row('Quán A'), row('Quán B'), row('Quán C')];
    expect(rankPlaceSuggestions('quan', rows)).toEqual(rows);
  });
});
