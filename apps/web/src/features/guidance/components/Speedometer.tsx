import { useId, useLayoutEffect, useRef } from 'react';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';
import { useI18n } from '../../../shared/i18n/I18nProvider';
import './Speedometer.css';

type SpeedometerProps = {
  speedKph: number | null;
  hasGpsFix: boolean;
  /** Điện thoại: né banner chỉ dẫn khi banner chuyển lên trên bảng báo cáo. */
  belowBanner?: boolean;
};

const MAX_DIAL_SPEED = 120;
// Bỏ hai vạch đầu/cuối để chừa khoảng riêng cho số 0 và 120.
const ticks = Array.from({ length: 23 }, (_, index) => {
  const step = index + 1;
  const angle = ((135 + (step * 270) / 24) * Math.PI) / 180;
  const major = step % 4 === 0;
  const inner = major ? 49 : 52;
  return {
    step,
    major,
    x1: (70 + inner * Math.cos(angle)).toFixed(2),
    y1: (70 + inner * Math.sin(angle)).toFixed(2),
    x2: (70 + 55 * Math.cos(angle)).toFixed(2),
    y2: (70 + 55 * Math.sin(angle)).toFixed(2),
  };
});

/** Chỉ hiển thị số đo GPS; hiệu ứng chạy cục bộ, không vẽ lại bản đồ mỗi khung hình. */
export function Speedometer({ speedKph, hasGpsFix, belowBanner = false }: SpeedometerProps) {
  const { t } = useI18n();
  const gradientId = useId();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const speed = speedKph !== null && Number.isFinite(speedKph) && speedKph >= 0 ? speedKph : null;
  const shown = useRef(speed ?? 0);
  const fillRef = useRef<SVGCircleElement>(null);
  const tipRef = useRef<SVGCircleElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const ratio = Math.min(speed ?? 0, MAX_DIAL_SPEED) / MAX_DIAL_SPEED;
  const angle = ((135 + 270 * ratio) * Math.PI) / 180;
  const label =
    speed === null
      ? t('Đang chờ tín hiệu GPS để đo tốc độ')
      : t('Tốc độ GPS hiện tại: {speed} km/h', { speed: Math.round(speed) });

  useLayoutEffect(() => {
    let frame = 0;
    const paint = (next: number) => {
      shown.current = next;
      const progress = speed === null ? 0 : Math.min(next, MAX_DIAL_SPEED) / MAX_DIAL_SPEED;
      const radians = ((135 + 270 * progress) * Math.PI) / 180;
      fillRef.current?.setAttribute('stroke-dasharray', `${75 * progress} 100`);
      fillRef.current?.setAttribute('opacity', progress > 0 ? '1' : '0');
      tipRef.current?.setAttribute('cx', String(70 + 61 * Math.cos(radians)));
      tipRef.current?.setAttribute('cy', String(70 + 61 * Math.sin(radians)));
      tipRef.current?.setAttribute('opacity', progress > 0 ? '1' : '0');
      if (valueRef.current) valueRef.current.textContent = speed === null ? '—' : String(Math.round(next));
    };
    if (speed === null || reducedMotion || shown.current === speed) {
      paint(speed ?? 0);
      return;
    }
    const from = shown.current;
    paint(from);
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = Math.min(1, (now - start) / 650);
      paint(from + (speed - from) * (1 - (1 - elapsed) ** 3));
      if (elapsed < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [speed, reducedMotion]);

  return (
    <div
      data-speedometer=""
      className={`speedometer pointer-events-none absolute right-3 z-30 ${belowBanner ? 'speedometer--below-banner' : ''}`}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="140" x2="140" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ff9a94" />
            <stop offset=".48" stopColor="#f45765" />
            <stop offset="1" stopColor="#dc2842" />
          </linearGradient>
        </defs>
        <circle
          className="speedometer__track"
          cx="70"
          cy="70"
          r="61"
          pathLength="100"
          transform="rotate(135 70 70)"
        />
        <circle
          ref={fillRef}
          className="speedometer__arc"
          cx="70"
          cy="70"
          r="61"
          pathLength="100"
          transform="rotate(135 70 70)"
          stroke={`url(#${gradientId})`}
          strokeDasharray={`${75 * ratio} 100`}
          opacity={ratio > 0 ? 1 : 0}
        />
        {ticks.map((tick) => (
          <line
            key={tick.step}
            className={`speedometer__tick ${tick.major ? 'speedometer__tick--major' : ''}`}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
          />
        ))}
        <text className="speedometer__label" x="41" y="101">
          0
        </text>
        <text className="speedometer__label" x="70" y="31">
          60
        </text>
        <text className="speedometer__label" x="99" y="101">
          120
        </text>
        <circle
          ref={tipRef}
          className="speedometer__tip"
          cx={70 + 61 * Math.cos(angle)}
          cy={70 + 61 * Math.sin(angle)}
          r="3.2"
          opacity={ratio > 0 ? 1 : 0}
        />
      </svg>
      <div className="speedometer__readout" aria-hidden="true">
        <span ref={valueRef} className="speedometer__value">
          {speed === null ? '—' : Math.round(speed)}
        </span>
        <span className="speedometer__unit">km/h</span>
      </div>
      <span
        className={`speedometer__signal ${hasGpsFix ? 'speedometer__signal--connected' : ''}`}
        aria-hidden="true"
      />
    </div>
  );
}
