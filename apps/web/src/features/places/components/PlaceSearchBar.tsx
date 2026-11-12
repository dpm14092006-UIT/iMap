import { useState, type Ref } from 'react';
import { popularPlaces } from '../data/popularPlaces';
import type { LatLng, Place } from '../types';
import { PlaceCombobox } from './PlaceCombobox';

type PlaceSearchBarProps = {
  getFocus?: () => LatLng;
  onSelect: (place: Place) => void;
  inputRef?: Ref<HTMLInputElement>;
};

/** Hiển thị gợi ý phím tắt trong ô tìm kiếm: "/" ở mọi nơi, ⌘K / Ctrl K cũng được. */
const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Command search ở thanh trên: chọn địa điểm để xem chi tiết trên bản đồ. */
export function PlaceSearchBar({ onSelect, getFocus, inputRef }: PlaceSearchBarProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  return (
    <div onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} className="relative">
      <PlaceCombobox
        getFocus={getFocus}
        ariaLabel="Tìm địa điểm trên bản đồ"
        className="w-full"
        icon="search"
        {...(inputRef ? { inputRef } : {})}
        inputClassName="h-12 rounded-full border-transparent bg-white/90 pr-16 text-sm shadow-glass dark:shadow-glass-dark ring-1 ring-black/5 backdrop-blur-xl hover:border-transparent focus:border-brand-500 dark:focus:border-indigo-400 focus:bg-white dark:bg-slate-900/85 dark:ring-white/10 dark:focus:bg-slate-900"
        maxSuggestions={7}
        onChange={setQuery}
        onSelect={(place) => {
          setQuery(place.name);
          onSelect(place);
        }}
        places={popularPlaces}
        placeholder="Tìm địa điểm, đường hoặc địa chỉ"
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
