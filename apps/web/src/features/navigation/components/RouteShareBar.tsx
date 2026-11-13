import { useState } from 'react';
import { Popover } from '../../../app/layout/Popover';
import { Icon, type IconName } from '../../../shared/components/Icon';
import type { TransportMode } from '../../map/types';
import type { Place } from '../../places/types';
import { buildRouteShareUrl } from '../services/routeShareLink';
import { useI18n } from '../../../shared/i18n/I18nProvider';

type RouteShareBarProps = { origin: Place; destination: Place; vehicle: TransportMode };

const buttonClass =
  'inline-flex h-9 items-center gap-1.5 rounded-full bg-white/70 px-3 text-xs font-semibold text-ink ring-1 ring-black/10 transition hover:bg-white dark:hover:bg-slate-700/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 active:scale-95 dark:bg-white/5 dark:text-slate-100 dark:ring-white/15';

/** Gửi tới điện thoại (hiện liên kết + hướng dẫn), sao chép liên kết và chia sẻ hệ thống. */
export function RouteShareBar({ origin, destination, vehicle }: RouteShareBarProps) {
  const { t } = useI18n();
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const link = () => buildRouteShareUrl({ origin, destination, vehicle }, window.location.href);
  const canShare = typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link());
      setNotice(t('Đã sao chép liên kết'));
    } catch {
      setNotice(t('Không tự sao chép được. Hãy chọn liên kết và nhấn Ctrl+C.'));
      setPhoneOpen(true);
    }
    window.setTimeout(() => setNotice(''), 3000);
  };
  const share = async () => {
    try {
      await navigator.share({ title: `${origin.name} → ${destination.name}`, url: link() });
    } catch {
      // Người dùng đóng hộp chia sẻ: không cần báo lỗi.
    }
  };
  const action = (icon: IconName, label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className={buttonClass}>
      <Icon name={icon} size={14} />
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('Chia sẻ tuyến')}>
        <Popover
          open={phoneOpen}
          onClose={() => setPhoneOpen(false)}
          label={t('Gửi tới điện thoại')}
          panelClassName="left-0 top-full mt-1.5 w-[300px]"
          trigger={
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={phoneOpen}
              onClick={() => setPhoneOpen((current) => !current)}
              className={buttonClass}
            >
              <Icon name="phone" size={14} />
              {t('Gửi tới điện thoại')}
            </button>
          }
        >
          <p className="text-xs font-bold text-ink dark:text-white">{t('Mở tuyến này trên điện thoại')}</p>
          <p className="mt-1 text-xs leading-5 text-ink-soft dark:text-slate-300">
            {t(
              'Sao chép liên kết dưới đây rồi gửi cho chính bạn qua Zalo, Messenger hoặc email, sau đó mở trên điện thoại.',
            )}
          </p>
          <input
            readOnly
            value={link()}
            aria-label={t('Liên kết tuyến đường')}
            onFocus={(event) => event.target.select()}
            className="mt-2 h-10 w-full rounded-xl bg-white/80 px-3 text-xs text-ink ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:text-slate-100 dark:ring-white/10 dark:focus:ring-indigo-400"
          />
          <button
            type="button"
            onClick={() => void copy()}
            className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-brand-gradient text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40"
          >
            <Icon name="link" size={14} />
            {t('Sao chép liên kết')}
          </button>
        </Popover>
        {action('link', t('Sao chép liên kết'), () => void copy())}
        {canShare && action('share', t('Chia sẻ'), () => void share())}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {notice}
      </p>
      {notice && (
        <p
          className="mt-1.5 pl-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
          aria-hidden="true"
        >
          {notice}
        </p>
      )}
    </div>
  );
}
