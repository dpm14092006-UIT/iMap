import { translate, type Language } from '../../../shared/i18n/translate';
import type { NavigationStatus } from '../types';
import { formatInstructionText } from '../../routing/domain/maneuver';

type Guidance = {
  status: NavigationStatus;
  offRoute: boolean;
  instruction: { text: string; sign?: number; streetName?: string } | null;
  distanceMeters: number;
  language: Language;
};

export function spokenDistance(meters: number, language: Language): string {
  if (meters >= 1000) {
    return translate(language, '{distance} ki lô mét', {
      distance: (Math.round(meters / 100) / 10).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US'),
    });
  }
  return translate(language, '{distance} mét', { distance: Math.max(10, Math.round(meters / 10) * 10) });
}

/** Ba lần nhắc cho mỗi bước: chuẩn bị, còn 200 m, và ngay trước chỗ rẽ. */
export function navigationAnnouncement({
  status,
  offRoute,
  instruction,
  distanceMeters,
  language,
}: Guidance) {
  if (status === 'idle' || status === 'locating') return null;
  if (status === 'arrived')
    return { status: 'arrived', phase: 0, text: translate(language, 'Bạn đã đến nơi.'), priority: true };
  if (status === 'error')
    return {
      status: 'error',
      phase: 0,
      text: translate(language, 'Mất tín hiệu GPS. Đang tìm lại vị trí.'),
      priority: true,
    };
  if (offRoute)
    return {
      status: 'off-route',
      phase: 0,
      text: translate(language, 'Bạn đang rời khỏi lộ trình. Đang kiểm tra đường đi.'),
      priority: true,
    };
  if (!instruction || !Number.isFinite(distanceMeters)) return null;
  const phase = distanceMeters <= 40 ? 2 : distanceMeters <= 200 ? 1 : 0;
  const action = formatInstructionText(instruction, language);
  return {
    status: 'guidance',
    phase,
    text:
      phase === 2
        ? action
        : translate(language, 'Sau {distance}, {instruction}', {
            distance: spokenDistance(distanceMeters, language),
            instruction: action,
          }),
    priority: false,
  };
}
