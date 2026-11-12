import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../../shared/components/Icon';
import { PlaceSearchBar } from '../../features/places/components/PlaceSearchBar';
import type { LatLng, Place } from '../../features/places/types';
import { BrandMark } from './BrandMark';

type TopBarProps = {
  getFocus: () => LatLng;
  onSelectPlace: (place: Place) => void;
  /** Hàng chip danh mục hoặc thanh "Tìm dọc tuyến". */
  strip: ReactNode;
  updateAvailable: boolean;
  onUpdate: () => void;
  onInfo: () => void;
  userEmail: string | null;
};

const roundButton =
  'grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/90 text-ink-soft shadow-glass ring-1 ring-black/5 backdrop-blur-xl transition hover:text-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:bg-slate-900/90 dark:text-slate-200 dark:shadow-glass-dark dark:ring-white/10 dark:hover:text-brand-300 dark:focus-visible:ring-brand-500/40';

/** Thanh trên: command search (phím tắt / và ⌘K), chip danh mục, cập nhật, thông tin và avatar. */
export function TopBar({
  getFocus,
  onSelectPlace,
  strip,
  updateAvailable,
  onUpdate,
  onInfo,
  userEmail,
}: TopBarProps) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches('input, textarea, select, [contenteditable="true"]') ?? false;
      const isShortcut =
        (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k');
      if (!isShortcut) return;
      event.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <header className="pointer-events-none absolute left-3 right-3 top-3 z-40 flex flex-wrap items-center gap-x-3 gap-y-2 md:left-[80px] lg:left-[88px] [&>*]:pointer-events-auto">
      <BrandMark className="md:hidden" />
      <div className="min-w-0 flex-1 md:w-[360px] md:flex-none lg:w-[400px]">
        <PlaceSearchBar getFocus={getFocus} onSelect={onSelectPlace} inputRef={input} />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 md:order-last">
        {updateAvailable && (
          <>
            <span className="sr-only" role="status" aria-live="polite">
              Có phiên bản iMap mới. Chọn Cập nhật để tải lại trang.
            </span>
            <button
              type="button"
              onClick={onUpdate}
              aria-label="Có phiên bản mới. Cập nhật iMap"
              title="Có phiên bản iMap mới"
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand-gradient px-3 text-xs font-bold text-white shadow-glass dark:shadow-glass-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 dark:focus-visible:ring-brand-500/50"
            >
              <Icon name="refresh" size={15} />
              Cập nhật
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onInfo}
          aria-label="Thông tin bản đồ"
          className={`${roundButton} max-md:hidden`}
        >
          <Icon name="info" size={19} />
        </button>
        <a
          href="/login"
          aria-label={userEmail ? `Tài khoản ${userEmail}` : 'Đăng nhập tài khoản'}
          className={`${roundButton} text-xs font-bold ${userEmail ? 'bg-brand-gradient text-white' : ''}`}
        >
          {userEmail ? userEmail.slice(0, 2).toUpperCase() : 'ĐN'}
        </a>
      </div>
      <div className="min-w-0 basis-full md:basis-0 md:flex-1">{strip}</div>
    </header>
  );
}
