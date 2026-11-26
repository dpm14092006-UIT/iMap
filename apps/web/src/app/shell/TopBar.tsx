import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ComboboxAction } from '../../features/places/components/PlaceCombobox';
import { PlaceSearchBar } from '../../features/places/components/PlaceSearchBar';
import type { Place } from '../../features/places/types';
import type { LatLng } from '../../shared/geo/types';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { Icon, type IconName } from '../../shared/ui/Icon';
import { Popover } from '../../shared/ui/Popover';
import type { FeatureKey } from '../types';

type TopBarProps = {
  getFocus: () => LatLng;
  onSelectPlace: (place: Place) => void;
  buildSearchAction?: (query: string) => ComboboxAction | null;
  strip: ReactNode;
  layers?: ReactNode;
  updateAvailable: boolean;
  onUpdate: () => void;
  onInfo: () => void;
  onShowVietnam?: () => void;
  userEmail: string | null;
  onSelectFeature: (feature: FeatureKey) => void;
};

const menuItems: { key: FeatureKey; label: string; icon: IconName }[] = [
  { key: 'traffic', label: 'Giao thông', icon: 'traffic' },
  { key: 'multi', label: 'Lộ trình nhiều điểm', icon: 'multi-stop' },
  { key: 'saved', label: 'Tuyến đã lưu', icon: 'bookmark' },
  { key: 'assistant', label: 'Trợ lý địa điểm', icon: 'sparkles' },
];
const menuRow = 'ui-button ui-button-ghost min-h-11 w-full justify-start gap-3 px-3 text-left text-sm';

export function TopBar({
  getFocus,
  onSelectPlace,
  buildSearchAction,
  strip,
  layers,
  updateAvailable,
  onUpdate,
  onInfo,
  onShowVietnam,
  userEmail,
  onSelectFeature,
}: TopBarProps) {
  const input = useRef<HTMLInputElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { language, setLanguage, t } = useI18n();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches('input, textarea, select, [contenteditable="true"]') ?? false;
      const isShortcut =
        (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k');
      if (!isShortcut) return;
      event.preventDefault();
      setMenuOpen(false);
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const directions = () => {
    setMenuOpen(false);
    onSelectFeature('directions');
  };

  return (
    <header className="imap-topbar">
      <a href="/" aria-label={t('iMap — về bản đồ')} className="imap-wordmark">
        iMap
      </a>
      <div className="imap-quick-search">
        <div className="min-w-0 flex-1">
          <PlaceSearchBar
            getFocus={getFocus}
            onSelect={onSelectPlace}
            inputRef={input}
            {...(buildSearchAction ? { buildAction: buildSearchAction } : {})}
          />
        </div>
        <button
          type="button"
          onClick={directions}
          className="ui-button ui-button-primary min-h-12 shrink-0 gap-1.5 px-3 text-sm md:min-h-11 md:px-4"
        >
          <Icon name="send" size={18} /> {t('Chỉ đường')}
        </button>
      </div>
      <Popover
        open={menuOpen}
        onClose={() => {
          if (menuButton.current?.parentElement?.contains(document.activeElement)) menuButton.current.focus();
          setMenuOpen(false);
        }}
        label="Menu"
        className="ml-auto shrink-0"
        panelClassName="right-0 top-full mt-2 max-h-[calc(100dvh-80px)] w-[min(320px,calc(100vw-24px))] overflow-y-auto !border !border-line !bg-surface !p-2"
        trigger={
          <button
            ref={menuButton}
            className="ui-button ui-button-secondary relative grid h-11 w-11 place-items-center p-0"
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            onClick={() => setMenuOpen((current) => !current)}
          >
            <Icon name="menu" size={22} />
            {updateAvailable && (
              <span
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary"
                aria-hidden="true"
              />
            )}
          </button>
        }
      >
        {updateAvailable && (
          <button type="button" onClick={onUpdate} className={`${menuRow} text-primary`}>
            <Icon name="refresh" />
            {t('Cập nhật iMap')}
          </button>
        )}
        <details className="mb-1">
          <summary className={`${menuRow} cursor-pointer list-none`}>
            <Icon name="search" />
            {t('Khám phá')}
            <Icon name="chevron-down" size={16} className="ml-auto" />
          </summary>
          <div
            onClick={(event) => {
              if ((event.target as Element).closest('button[aria-pressed]')) setMenuOpen(false);
            }}
            className="px-2 pb-2"
          >
            {strip}
          </div>
        </details>
        {menuItems.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            className={menuRow}
            onClick={() => {
              setMenuOpen(false);
              onSelectFeature(key);
            }}
          >
            <Icon name={icon} />
            {t(label)}
          </button>
        ))}
        {layers && <div className="md:hidden">{layers}</div>}
        {onShowVietnam && (
          <button
            type="button"
            className={menuRow}
            onClick={() => {
              setMenuOpen(false);
              onShowVietnam();
            }}
          >
            <Icon name="globe" />
            {t('Xem toàn Việt Nam')}
          </button>
        )}
        <button
          type="button"
          className={menuRow}
          onClick={() => {
            setMenuOpen(false);
            onInfo();
          }}
        >
          <Icon name="info" />
          {t('Thông tin bản đồ')}
        </button>
        <div className="mt-1 border-t border-line pt-1">
          {userEmail ? (
            <a
              href="/login"
              className={menuRow}
              aria-label={`${t('Tài khoản')} ${userEmail}`}
              title={userEmail}
            >
              <Icon name="user" />
              {userEmail.slice(0, 2).toUpperCase()}
            </a>
          ) : (
            <a href="/login" className={menuRow} aria-label={t('Đăng nhập tài khoản')}>
              <Icon name="user" />
              {t('Đăng nhập')}
            </a>
          )}
          <label className="flex min-h-11 items-center gap-3 px-3 text-sm font-medium">
            <Icon name="globe" />
            <span className="flex-1">{t('Ngôn ngữ')}</span>
            <select
              aria-label={t('Ngôn ngữ')}
              value={language}
              onChange={(event) => setLanguage(event.target.value === 'en' ? 'en' : 'vi')}
              className="ui-field min-h-11 w-auto font-semibold"
            >
              <option value="vi">VI</option>
              <option value="en">EN</option>
            </select>
          </label>
        </div>
      </Popover>
    </header>
  );
}
