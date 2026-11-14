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

  it('translates GPS permission and signal errors in English mode', () => {
    expect(translate('en', 'Chưa có quyền GPS. Hãy cho phép định vị rồi thử lại.')).toBe(
      'GPS permission is unavailable. Allow location access and try again.',
    );
    expect(translate('en', 'GPS đang bắt tín hiệu. Đang tiếp tục tìm vị trí…')).toBe(
      'GPS is acquiring a signal. Still looking for your location…',
    );
    expect(translate('en', 'Tín hiệu GPS tạm thời không ổn định.')).toBe(
      'The GPS signal is temporarily unstable.',
    );
    expect(translate('en', 'Thiết bị này không hỗ trợ định vị GPS.')).toBe(
      'This device does not support GPS location.',
    );
  });

  it('preserves unknown text, such as user supplied place names', () => {
    expect(translate('en', 'Bánh mì cô Ba')).toBe('Bánh mì cô Ba');
  });
});

const placeCountScenarios = Array.from({ length: 50 }, (_, index) => [
  { count: index, language: 'vi' as const },
  { count: index, language: 'en' as const },
]).flat();

describe('dynamic place count regression matrix', () => {
  it.each(placeCountScenarios)('translates count $count in $language mode', ({ count, language }) => {
    const source = `Tìm thấy ${count} địa điểm`;
    expect(translate(language, source)).toBe(language === 'en' ? `Found ${count} places` : source);
  });
});
