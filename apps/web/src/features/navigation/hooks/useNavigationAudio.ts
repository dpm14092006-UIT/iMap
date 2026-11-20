import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../shared/i18n/I18nProvider';
import { prepareAlertAudio } from '../../notifications/services/alertFeedback';
import { NavigationSpeaker } from '../services/NavigationSpeaker';
import { navigationAnnouncement, spokenDistance } from '../services/navigationAnnouncement';
import type { NavigationStatus } from './useNavigationSession';

const STORAGE_KEY = 'imap-navigation-audio';
type Options = {
  routeId: string | null;
  status: NavigationStatus;
  offRoute: boolean;
  instruction: { text: string; sign?: number; streetName?: string } | null;
  instructionIndex: number;
  distanceMeters: number;
  alert: { incident: { id: string; title: string }; distanceAheadMeters: number | null } | null;
};

export function useNavigationAudio(options: Options) {
  const { language, t } = useI18n();
  const [speaker] = useState(() => new NavigationSpeaker());
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'muted';
    } catch {
      return true;
    }
  });
  const enabledRef = useRef(enabled);
  const latest = useRef(options);
  latest.current = options;
  const phases = useRef(new Map<number, number>());
  const lastStatus = useRef('');
  const lastAlert = useRef('');

  useEffect(() => {
    phases.current.clear();
    lastStatus.current = '';
    lastAlert.current = '';
    speaker.stop();
  }, [options.routeId, language, speaker]);
  useEffect(() => () => speaker.stop(), [speaker]);

  const begin = useCallback(() => {
    phases.current.clear();
    lastStatus.current = '';
    lastAlert.current = '';
    if (!enabledRef.current) return;
    prepareAlertAudio();
    speaker.speak(t('Bắt đầu dẫn đường.'), language);
  }, [speaker, language, t]);

  const toggle = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'enabled' : 'muted');
    } catch {
      /* Dùng trong phiên này. */
    }
    speaker.stop();
    if (next) {
      prepareAlertAudio();
      lastStatus.current = '';
      phases.current.clear();
      speaker.speak(t('Đã bật âm thanh chỉ đường.'), language);
    }
  }, [speaker, language, t]);

  const alertId = options.alert?.incident.id;
  useEffect(() => {
    if (!enabled || !alertId || lastAlert.current === alertId) return;
    // Chừa thời gian cho ba tiếng chuông cảnh báo, sau đó mới đọc nội dung.
    const timer = window.setTimeout(() => {
      const alert = latest.current.alert;
      if (!alert || alert.incident.id !== alertId) return;
      const text =
        alert.distanceAheadMeters === null
          ? t('Cảnh báo: {incident} trên tuyến của bạn.', { incident: t(alert.incident.title) })
          : t('Cảnh báo: {incident}, phía trước {distance}.', {
              incident: t(alert.incident.title),
              distance: spokenDistance(alert.distanceAheadMeters, language),
            });
      if (speaker.speak(text, language, true)) lastAlert.current = alertId;
    }, 850);
    return () => window.clearTimeout(timer);
  }, [alertId, enabled, language, speaker, t]);

  useEffect(() => {
    if (options.status === 'idle' && !options.alert) {
      speaker.stop();
      return;
    }
    if (!enabled || options.alert) return;
    if (options.status === 'navigating' && !options.offRoute) lastStatus.current = '';
    const announcement = navigationAnnouncement({
      status: options.status,
      offRoute: options.offRoute,
      instruction: options.instruction,
      distanceMeters: options.distanceMeters,
      language,
    });
    if (!announcement) return;
    if (announcement.status === 'guidance') {
      lastStatus.current = '';
      if ((phases.current.get(options.instructionIndex) ?? -1) >= announcement.phase) return;
    } else if (lastStatus.current === announcement.status) return;
    if (speaker.speak(announcement.text, language, announcement.priority)) {
      if (announcement.status === 'guidance')
        phases.current.set(options.instructionIndex, announcement.phase);
      else lastStatus.current = announcement.status;
    }
  }, [
    enabled,
    language,
    options.status,
    options.offRoute,
    options.instruction,
    options.instructionIndex,
    options.distanceMeters,
    options.alert,
    speaker,
  ]);

  return { enabled, supported: speaker.supported, begin, toggle };
}
