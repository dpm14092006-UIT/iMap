import { useState, type Ref } from 'react';
import type { LatLng } from '../../../shared/geo/types';
import { useI18n } from '../../../shared/i18n/I18nProvider';
import { popularPlaces } from '../domain/popularPlaces';
import type { Place } from '../types';
import { PlaceCombobox, type ComboboxAction } from './PlaceCombobox';

type PlaceSearchBarProps = {
  getFocus?: () => LatLng;
  onSelect: (place: Place) => void;
  inputRef?: Ref<HTMLInputElement>;
  /** Dựng dòng "Tìm … quanh đây / dọc tuyến" từ nội dung đang gõ. */
  buildAction?: (query: string) => ComboboxAction | null;
};

/** Hiển thị gợi ý phím tắt trong ô tìm kiếm: "/" ở mọi nơi, ⌘K / Ctrl K cũng được. */
const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Command search ở thanh trên: chọn địa điểm để xem chi tiết trên bản đồ. */
export function PlaceSearchBar({ onSelect, getFocus, inputRef, buildAction }: PlaceSearchBarProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  return (
    <div onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} className="relative">
      <PlaceCombobox
        getFocus={getFocus}
        ariaLabel={t('Tìm địa điểm trên bản đồ')}
        className="w-full"
        icon="search"
        {...(inputRef ? { inputRef } : {})}
        inputClassName="h-12 rounded-xl !border-line !bg-surface !text-content !placeholder:text-content-muted pr-16 text-base md:h-11 md:text-sm max-md:pr-3"
        maxSuggestions={7}
        listPositionClassName="absolute left-0 right-0 top-[calc(100%+7px)] max-md:fixed max-md:inset-x-3 max-md:top-[68px]"
        onChange={setQuery}
        onSelect={(place) => {
          setQuery(place.name);
          onSelect(place);
        }}
        places={popularPlaces}
        action={buildAction?.(query) ?? null}
        placeholder={t('Tìm địa điểm')}
        value={query}
      />
      {!focused && !query && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 items-center gap-1 text-[11px] font-semibold text-slate-500 md:flex dark:text-slate-400"
        >
          <kbd className="rounded-md bg-black/5 px-1.5 py-0.5 font-sans dark:bg-white/10">/</kbd>
          <kbd className="rounded-md bg-black/5 px-1.5 py-0.5 font-sans dark:bg-white/10">
            {isApple ? '⌘K' : 'Ctrl K'}
          </kbd>
        </span>
      )}
    </div>
  );
}
