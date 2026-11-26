import { useState } from 'react';
import { Icon } from '../../../shared/ui/Icon';
import haNoi from '../assets/ha-noi-illustration.webp';
import haGiang from '../assets/ha-giang-illustration.webp';
import daLat from '../assets/da-lat-illustration.webp';
import tphcm from '../assets/tphcm-riverside-illustration.webp';
import anGiang from '../assets/an-giang-rice-canal.webp';
import hue from '../assets/hue-ngo-mon.webp';
import hoiAn from '../assets/hoi-an-illustration.webp';
import haLong from '../assets/ha-long-illustration.webp';
import './auth-scenery.css';

const scenes = [
  { id: 'ha-noi', image: haNoi, name: 'Hồ Hoàn Kiếm', region: 'Hà Nội' },
  { id: 'ha-giang', image: haGiang, name: 'Sông Nho Quế', region: 'Hà Giang · nhìn từ Mã Pí Lèng' },
  { id: 'da-lat', image: daLat, name: 'Hồ Xuân Hương', region: 'Đà Lạt' },
  { id: 'tphcm', image: tphcm, name: 'Bờ sông Sài Gòn', region: 'TP.HCM' },
  { id: 'an-giang', image: anGiang, name: 'Mùa lúa ven kênh', region: 'An Giang · Miền Tây' },
  { id: 'hue', image: hue, name: 'Ngọ Môn – Đại Nội', region: 'Huế' },
  { id: 'hoi-an', image: hoiAn, name: 'Chùa Cầu', region: 'Hội An' },
  { id: 'ha-long', image: haLong, name: 'Vịnh Hạ Long', region: 'Quảng Ninh' },
] as const;

export function AuthScenery({ language, initialScene }: { language: 'vi' | 'en'; initialScene?: string }) {
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      scenes.findIndex(({ id }) => id === initialScene),
    ),
  );
  const isEnglish = language === 'en';
  const scene = scenes[index] ?? scenes[0];
  const nextIndex = (index + 1) % scenes.length;
  const previousIndex = (index + scenes.length - 1) % scenes.length;

  function step(offset: number) {
    setIndex((current) => (current + offset + scenes.length) % scenes.length);
  }

  const control = 'imap-scenery-control';
  return (
    <aside className="imap-scenery" aria-label={isEnglish ? 'Scenes of Vietnam' : 'Phong cảnh Việt Nam'}>
      {scenes.map(({ id, image }, sceneIndex) =>
        sceneIndex === index || sceneIndex === previousIndex || sceneIndex === nextIndex ? (
          <div className="imap-scenery-slide" data-active={sceneIndex === index} data-scene={id} key={id}>
            <img src={image} alt="" decoding="async" fetchPriority={sceneIndex === index ? 'high' : 'low'} />
          </div>
        ) : null,
      )}
      <svg
        className="imap-scenery-trail"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        aria-hidden="true"
        fill="none"
      >
        <path
          d="M-40 875C161 800 251 811 380 759C545 692 620 747 754 684C896 617 1001 674 1110 601C1230 520 1340 556 1480 456"
          stroke="currentColor"
          strokeWidth="1.15"
          opacity=".58"
          vectorEffect="non-scaling-stroke"
        />
        <path
          key={scene.id}
          className="imap-trail-spark"
          d="M-40 875C161 800 251 811 380 759C545 692 620 747 754 684C896 617 1001 674 1110 601C1230 520 1340 556 1480 456"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <g fill="currentColor">
          <circle cx="380" cy="759" r="4" />
          <circle cx="754" cy="684" r="5" />
          <circle cx="1110" cy="601" r="4" />
        </g>
      </svg>
      <div className="imap-scenery-footer">
        <div className="imap-scenery-caption" aria-live="polite">
          <p>{scene.name}</p>
          <span>
            {scene.region} · {index + 1}/{scenes.length}
          </span>
        </div>
        <div className="imap-scenery-controls">
          <button
            type="button"
            className={control}
            onClick={() => step(-1)}
            aria-label={isEnglish ? 'Previous image' : 'Ảnh trước'}
          >
            <Icon name="chevron-left" size={21} />
          </button>
          <button
            type="button"
            className={control}
            onClick={() => step(1)}
            aria-label={isEnglish ? 'Next image' : 'Ảnh tiếp theo'}
          >
            <Icon name="chevron-right" size={21} />
          </button>
        </div>
      </div>
    </aside>
  );
}
