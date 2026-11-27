import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDurationShort } from '../../../shared/format/units';
import { useI18n } from '../../../shared/i18n/I18nProvider';
import { Icon } from '../../../shared/ui/Icon';
import { buildPlaybackTimeline, routePlayback, type PlaybackFrame } from '../../routing/domain/routePlayback';
import type { RoutePlan } from '../../routing/types';

/** Tốc độ phát lại so với thời gian thật (tuyến 30 phút ở ×60 phát trong 30 giây). */
export const PLAYBACK_SPEEDS = [60, 240, 960] as const;
const MINUTES_PER_DAY = 24 * 60;

type TimelineBarProps = {
  route: RoutePlan | null;
  onFrame: (frame: PlaybackFrame | null) => void;
  onLightTime: (time: number | null) => void;
  onClose: () => void;
  /** Bắt đầu với giờ cố định (kiểm thử); mặc định là giờ hiện tại. */
  now?: () => Date;
};

const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`;

/**
 * Dòng thời gian (4D): phát lại hành trình theo thời gian VietMap trả về và ánh sáng theo giờ trong ngày.
 * Đóng thanh này thì bản đồ trở về ánh sáng mặc định và camera thường.
 */
export function TimelineBar({
  route,
  onFrame,
  onLightTime,
  onClose,
  now = () => new Date(),
}: TimelineBarProps) {
  const { t, language } = useI18n();
  const duration = (value: number) => formatDurationShort(Math.round(value / 60), language);
  const [dayStart] = useState(() => {
    const today = now();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
  });
  const [minuteOfDay, setMinuteOfDay] = useState(() => {
    const current = now();
    return current.getHours() * 60 + current.getMinutes();
  });
  const timeline = useMemo(() => (route ? buildPlaybackTimeline(route) : null), [route]);
  const [seconds, setSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(PLAYBACK_SPEEDS[0]);
  const handlers = useRef({ onFrame, onLightTime });
  handlers.current = { onFrame, onLightTime };

  // Ánh sáng: giờ trong ngày được chọn; khi phát lại thì đi theo giờ của hành trình.
  const lightMinutes = minuteOfDay + (playing || seconds > 0 ? seconds / 60 : 0);
  useEffect(() => {
    handlers.current.onLightTime(dayStart + Math.round(lightMinutes) * 60_000);
  }, [dayStart, lightMinutes]);
  useEffect(() => () => handlers.current.onLightTime(null), []);

  // Tuyến đổi: về đầu tuyến.
  useEffect(() => {
    setSeconds(0);
    setPlaying(false);
    handlers.current.onFrame(null);
  }, [timeline]);
  useEffect(() => () => handlers.current.onFrame(null), []);

  useEffect(() => {
    if (!timeline || (!playing && seconds === 0)) return;
    handlers.current.onFrame(routePlayback(timeline, seconds));
  }, [timeline, seconds, playing]);

  useEffect(() => {
    if (!playing || !timeline) return;
    let frame = 0;
    let last = performance.now();
    const tick = (time: number) => {
      const delta = ((time - last) / 1000) * speed;
      last = time;
      setSeconds((current) => {
        const next = Math.min(timeline.totalSeconds, current + delta);
        if (next >= timeline.totalSeconds) setPlaying(false);
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, timeline]);

  const total = timeline?.totalSeconds ?? 0;
  const togglePlay = () => {
    if (!timeline) return;
    if (!playing && seconds >= total) setSeconds(0);
    setPlaying(!playing);
  };
  const stopPlayback = () => {
    setPlaying(false);
    setSeconds(0);
    handlers.current.onFrame(null);
  };

  return (
    <section
      className="routetwin-timeline pointer-events-auto w-[min(92vw,420px)] rounded-xl bg-surface p-3 text-sm shadow-glass ring-1 ring-line dark:shadow-glass-dark"
      aria-label={t('Dòng thời gian')}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold text-ink">{t('Dòng thời gian')}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('Đóng dòng thời gian')}
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-brand-50"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <label className="flex items-center gap-2">
        <Icon name="sun" size={18} />
        <span className="w-16 shrink-0 text-ink-soft">{t('Giờ')}</span>
        <input
          type="range"
          min={0}
          max={MINUTES_PER_DAY - 1}
          step={5}
          value={minuteOfDay}
          onChange={(event) => setMinuteOfDay(Number(event.target.value))}
          aria-label={t('Giờ trong ngày')}
          aria-valuetext={clock(minuteOfDay)}
          className="min-w-0 flex-1 accent-brand-600"
          data-testid="timeline-hour"
        />
        <output className="w-12 text-right tabular-nums" data-testid="timeline-clock">
          {clock(lightMinutes)}
        </output>
      </label>
      <p className="mt-1 text-xs text-ink-soft">{t('Ánh sáng mô phỏng theo vị trí mặt trời')}</p>

      {timeline && total > 0 ? (
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={t(playing ? 'Tạm dừng phát lại' : 'Phát lại hành trình')}
              aria-pressed={playing}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600 text-white hover:bg-brand-700"
              data-testid="timeline-play"
            >
              <Icon name={playing ? 'pause' : 'play'} size={18} />
            </button>
            <input
              type="range"
              min={0}
              max={Math.round(total)}
              step={1}
              value={Math.round(seconds)}
              onChange={(event) => {
                setPlaying(false);
                setSeconds(Number(event.target.value));
              }}
              aria-label={t('Vị trí trong hành trình')}
              aria-valuetext={`${duration(seconds)} / ${duration(total)}`}
              className="min-w-0 flex-1 accent-brand-600"
              data-testid="timeline-progress"
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-ink-soft">
            <span className="tabular-nums">
              {duration(seconds)} / {duration(total)}
            </span>
            <span className="flex items-center gap-1" role="group" aria-label={t('Tốc độ phát lại')}>
              {PLAYBACK_SPEEDS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSpeed(value)}
                  aria-pressed={speed === value}
                  className={`rounded-md px-2 py-0.5 tabular-nums ${speed === value ? 'bg-brand-600 text-white' : 'hover:bg-brand-50'}`}
                >
                  ×{value}
                </button>
              ))}
              {seconds > 0 && (
                <button
                  type="button"
                  onClick={stopPlayback}
                  className="ml-1 rounded-md px-2 py-0.5 hover:bg-brand-50"
                >
                  {t('Dừng')}
                </button>
              )}
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-3 border-t border-line pt-3 text-xs text-ink-soft">
          {t('Tìm đường để phát lại hành trình trên bản đồ.')}
        </p>
      )}
    </section>
  );
}
