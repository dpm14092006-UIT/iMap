import { describe, expect, it, vi } from 'vitest';
import { readLanguage, translate } from './I18nProvider';

describe('language selection', () => {
  it('defaults to Vietnamese for empty or unsupported stored values', () => {
    expect(readLanguage({ getItem: vi.fn().mockReturnValue(null) })).toBe('vi');
    expect(readLanguage({ getItem: vi.fn().mockReturnValue('fr') })).toBe('vi');
  });

  it('restores English when it was selected previously', () => {
    expect(readLanguage({ getItem: vi.fn().mockReturnValue('en') })).toBe('en');
  });

  it('falls back to Vietnamese when storage is unavailable', () => {
    expect(
      readLanguage({
        getItem: () => {
          throw new Error('storage disabled');
        },
      }),
    ).toBe('vi');
  });
});

describe('translate', () => {
  it('keeps Vietnamese copy in Vietnamese and translates it to English', () => {
    expect(translate('vi', 'Chỉ đường')).toBe('Chỉ đường');
    expect(translate('en', 'Chỉ đường')).toBe('Directions');
  });

  it('interpolates values after translation', () => {
    expect(translate('en', 'Tìm thấy {count} địa điểm', { count: 3 })).toBe('Found 3 places');
  });

  it('translates known server messages that contain dynamic values', () => {
    expect(translate('en', 'Chưa tính được tuyến qua 2 địa điểm; kết quả có thể chưa đầy đủ.')).toBe(
      'Could not calculate routes through 2 places; results may be incomplete.',
    );
  });

  it('preserves unknown text, such as user supplied place names', () => {
    expect(translate('en', 'Bánh mì cô Ba')).toBe('Bánh mì cô Ba');
  });
});
