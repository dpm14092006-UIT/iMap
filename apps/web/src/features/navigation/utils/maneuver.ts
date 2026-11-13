import type { Language } from '../../../shared/i18n/I18nProvider';
import { translate } from '../../../shared/i18n/I18nProvider';

/**
 * Đổi mã `sign` trong hướng dẫn rẽ của VietMap (chuẩn GraphHopper) thành ký hiệu mũi tên.
 * Tham khảo: -3 rẽ gắt trái … 0 đi thẳng … 3 rẽ gắt phải, 4 đến nơi, 6 vòng xuyến.
 */
const SIGN_ARROWS: Record<number, string> = {
  [-98]: '↶', // quay đầu
  [-8]: '↶', // quay đầu bên trái
  [-7]: '↖', // đi về làn trái
  [-3]: '↰', // rẽ gắt trái
  [-2]: '↰', // rẽ trái
  [-1]: '↖', // chếch trái
  0: '↑', // đi thẳng
  1: '↗', // chếch phải
  2: '↱', // rẽ phải
  3: '↱', // rẽ gắt phải
  4: '⚑', // đã đến nơi
  5: '•', // qua điểm dừng
  6: '⟳', // vòng xuyến
  7: '↗', // đi về làn phải
  8: '↷', // quay đầu bên phải
};

/** Mũi tên cho một bước chỉ dẫn; không rõ mã thì coi như đi thẳng. */
export function maneuverArrow(sign: number | undefined): string {
  return sign === undefined ? '↑' : (SIGN_ARROWS[sign] ?? '↑');
}
const ENGLISH_MANEUVER: Record<number, string> = {
  [-98]: 'Quay đầu',
  [-8]: 'Quay đầu',
  [-7]: 'Giữ làn trái',
  [-3]: 'Rẽ gắt trái',
  [-2]: 'Rẽ trái',
  [-1]: 'Rẽ nhẹ trái',
  0: 'Đi thẳng',
  1: 'Rẽ nhẹ phải',
  2: 'Rẽ phải',
  3: 'Rẽ gắt phải',
  4: 'Đến nơi',
  5: 'Qua điểm dừng',
  6: 'Vào vòng xuyến',
  7: 'Giữ làn phải',
  8: 'Quay đầu',
};

/** Uses the routing maneuver code to show English directions while preserving road names. */
export function formatInstructionText(
  step: { text: string; sign?: number; streetName?: string },
  language: Language,
): string {
  const source = step.text.trim() || step.streetName?.trim() || 'Tiếp tục theo đường';
  if (language === 'vi') return source;

  const street = step.streetName?.trim() ?? '';
  const fallback = street ? `Continue on ${street}` : 'Continue along the route';
  if (step.sign === undefined) {
    const translated = translate(language, source);
    return translated === source ? fallback : translated;
  }

  const maneuver = ENGLISH_MANEUVER[step.sign];
  if (!maneuver) {
    const translated = translate(language, source);
    return translated === source ? fallback : translated;
  }
  const action = translate(language, maneuver);
  if (!street || [4, 5, 6, -98, -8, 8].includes(step.sign)) return action;
  if (step.sign === 0) return `${action} on ${street}`;
  if (step.sign === 7 || step.sign === -7) return `${action} for ${street}`;
  return `${action} onto ${street}`;
}
