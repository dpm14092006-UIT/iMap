import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { Icon, type IconName } from '../../../shared/components/Icon';
import { MIN_QUERY_LENGTH, usePlaceSearch } from '../hooks/usePlaceSearch';
import { foldVietnamese } from '../../../shared/text/foldVietnamese';
import { placeApi } from '../api/placeApi';
import type { LatLng, Place, PlaceSearchSuggestion } from '../types';

/** Hai địa điểm coi là trùng nếu cùng tên và cách nhau rất gần (~400 m). */
function isSamePlace(a: PlaceSearchSuggestion, b: PlaceSearchSuggestion) {
  return (
    a.id === b.id ||
    (foldVietnamese(a.name) === foldVietnamese(b.name) &&
      foldVietnamese(a.address) === foldVietnamese(b.address))
  );
}

type PlaceComboboxProps = {
  value: string;
  getFocus?: () => LatLng;
  /** Địa điểm gợi ý có sẵn (lọc tại chỗ, không cần gọi API). */
  places: Place[];
  onChange: (value: string) => void;
  onSelect: (place: Place) => void;
  placeholder: string;
  icon?: IconName | null;
  className?: string;
  inputClassName?: string;
  ariaLabel: string;
  maxSuggestions?: number;
  /** Để nơi dùng focus ô nhập bằng phím tắt. */
  inputRef?: Ref<HTMLInputElement>;
};

/**
 * Ô nhập có gợi ý địa điểm (autocomplete).
 * Kết hợp địa điểm có sẵn + kết quả Photon/OSM, hỗ trợ phím ↑ ↓ Enter Esc.
 */
export function PlaceCombobox({
  value,
  getFocus,
  places,
  onChange,
  onSelect,
  placeholder,
  icon = 'search',
  className = '',
  inputClassName = '',
  ariaLabel,
  maxSuggestions = 6,
  inputRef,
}: PlaceComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchKind, setSearchKind] = useState<'all' | 'street'>('all');
  const [focus, setFocus] = useState<LatLng>({ lat: 10.779, lng: 106.701 });
  const [resolving, setResolving] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const selectionRef = useRef<AbortController | null>(null);
  useEffect(() => {
    selectionRef.current?.abort();
    setResolving(false);
    setSelectionError('');
  }, [value]);
  useEffect(() => () => selectionRef.current?.abort(), []);
  const {
    results: remotePlaces,
    status,
    error: searchError,
  } = usePlaceSearch(value, focus, open, searchKind);

  // Gộp địa điểm có sẵn (ưu tiên) với kết quả từ API, bỏ trùng và giới hạn số lượng.
  const matches = useMemo(() => {
    const query = foldVietnamese(value);
    if (query.length < MIN_QUERY_LENGTH) return [];
    const local = (searchKind === 'street' ? [] : places).filter((place) =>
      foldVietnamese(`${place.name} ${place.address} ${place.category}`).includes(query),
    );
    const remainingLocal = local.filter(
      (place) => !remotePlaces.some((candidate) => isSamePlace(place, candidate)),
    );
    return [...remotePlaces, ...remainingLocal].slice(0, maxSuggestions);
  }, [maxSuggestions, places, remotePlaces, value, searchKind]);

  const showList = open && value.trim().length >= MIN_QUERY_LENGTH;

  const choose = async (suggestion: PlaceSearchSuggestion) => {
    selectionRef.current?.abort();
    const controller = new AbortController();
    selectionRef.current = controller;
    setResolving(true);
    setSelectionError('');
    try {
      const place = await placeApi.resolve(suggestion, controller.signal);
      if (controller.signal.aborted) return;
      onChange(place.name);
      onSelect(place);
      setOpen(false);
    } catch (cause) {
      if (!controller.signal.aborted)
        setSelectionError(cause instanceof Error ? cause.message : 'Không lấy được tọa độ địa điểm.');
    } finally {
      if (!controller.signal.aborted) setResolving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      selectionRef.current?.abort();
      setResolving(false);
    }
    if (resolving) {
      if (event.key === 'Enter') event.preventDefault();
      return;
    }
    if (!showList || matches.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => (current + step + matches.length) % matches.length);
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      void choose(matches[Math.min(activeIndex, matches.length - 1)]!);
    }
  };

  /** Thông báo khi danh sách trống, tùy theo trạng thái gọi API. */
  const emptyMessage =
    status === 'loading'
      ? 'Đang tìm địa điểm…'
      : status === 'error'
        ? searchError || 'Không kết nối được dịch vụ tìm kiếm. Thử lại hoặc chọn trên bản đồ.'
        : 'Chưa tìm thấy địa chỉ phù hợp. Thử thêm phường, tỉnh/thành hoặc chọn điểm trên bản đồ.';

  return (
    <div
      className={`relative ${className}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      {icon && (
        <Icon
          name={icon}
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400 dark:text-slate-500"
        />
      )}
      <input
        ref={inputRef}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showList && matches.length > 0}
        aria-activedescendant={showList && matches[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        className={`h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 text-sm text-slate-800 outline-none transition placeholder:text-slate-500 hover:border-slate-300 dark:hover:border-white/20 focus:border-brand-500 dark:focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-brand-100 dark:border-white/15 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800 dark:focus:ring-brand-500/30 ${icon ? 'pl-10' : 'pl-3'} pr-3 ${inputClassName}`}
        onChange={(event) => {
          selectionRef.current?.abort();
          setResolving(false);
          setSelectionError('');
          if (getFocus) setFocus(getFocus());
          onChange(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => {
          if (getFocus) setFocus(getFocus());
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        value={value}
      />
      {selectionError && (
        <p role="alert" className="mt-1 text-xs text-amber-800 dark:text-amber-200">
          {selectionError}
        </p>
      )}
      {showList && (
        <div className="absolute left-0 right-0 top-[calc(100%+7px)] z-[80] overflow-hidden rounded-2xl border border-slate-100 bg-white p-1.5 shadow-float dark:shadow-float-dark dark:border-white/10 dark:bg-slate-800">
          <div
            className="mb-1 flex gap-1 border-b border-slate-100 dark:border-white/10 p-1"
            role="group"
            aria-label="Loại tìm kiếm"
          >
            {(['all', 'street'] as const).map((kind) => (
              <button
                type="button"
                key={kind}
                aria-pressed={searchKind === kind}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  selectionRef.current?.abort();
                  setResolving(false);
                  setSearchKind(kind);
                  setActiveIndex(0);
                }}
                className={`rounded-lg px-3 py-1.5 text-[11px] ${searchKind === kind ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200' : 'text-slate-500 dark:text-slate-400'}`}
              >
                {kind === 'all' ? 'Tất cả' : 'Tên đường'}
              </button>
            ))}
          </div>
          {matches.length > 0 ? (
            <div id={listId} role="listbox" aria-label="Gợi ý địa điểm">
              {matches.map((place, index) => (
                <button
                  key={place.id}
                  id={`${listId}-${index}`}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 focus:outline-none dark:hover:bg-white/10 ${index === activeIndex ? 'bg-slate-50 dark:bg-white/10' : ''}`}
                  onMouseDown={(event) => event.preventDefault()} // giữ focus ở input khi click
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    void choose(place);
                  }}
                  disabled={resolving}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-200">
                    <Icon name="pin" size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink dark:text-white">
                      {place.name}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                      {place.address}
                    </span>
                  </span>
                  <Icon
                    name="arrow-up-right"
                    size={15}
                    className="shrink-0 text-slate-400 dark:text-slate-500"
                  />
                </button>
              ))}
            </div>
          ) : (
            <p className="px-3 py-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{emptyMessage}</p>
          )}
          {matches.length === 0 && status === 'ready' && /^\d[\dA-Za-z/-]*\s+/.test(value.trim()) && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(value.trim().replace(/^\d[\dA-Za-z/-]*\s+/, ''));
                setSearchKind('street');
                setActiveIndex(0);
              }}
              className="px-3 pb-3 text-left text-[11px] font-semibold text-brand-700 dark:text-indigo-300"
            >
              Tìm tên đường, bỏ số nhà
            </button>
          )}
          {status === 'error' && matches.length > 0 && (
            <p role="alert" className="px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              {emptyMessage}
            </p>
          )}
          <div
            role="status"
            className="border-t border-slate-100 dark:border-white/10 px-3 py-2 text-[11px] font-medium text-slate-400 dark:text-slate-500"
          >
            {resolving
              ? 'Đang lấy tọa độ địa điểm…'
              : status === 'loading'
                ? 'Đang tìm thêm…'
                : status === 'ready' || remotePlaces.some((place) => place.source === 'vietmap')
                  ? 'VietMap · ưu tiên gần khu vực tìm kiếm'
                  : 'Địa điểm gợi ý có sẵn'}
          </div>
        </div>
      )}
    </div>
  );
}
