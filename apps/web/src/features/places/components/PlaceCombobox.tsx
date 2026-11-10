import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Icon, type IconName } from '../../../shared/components/Icon';
import { MIN_QUERY_LENGTH, usePlaceSearch } from '../hooks/usePlaceSearch';
import { placeApi } from '../api/placeApi';
import type { LatLng, Place, PlaceSearchSuggestion } from '../types';

/** Bỏ dấu tiếng Việt và chữ hoa để so khớp "ben thanh" với "Bến Thành". */
function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

/** Hai địa điểm coi là trùng nếu cùng tên và cách nhau rất gần (~400 m). */
function isSamePlace(a: PlaceSearchSuggestion, b: PlaceSearchSuggestion) {
  return a.id === b.id || (normalize(a.name) === normalize(b.name) && normalize(a.address) === normalize(b.address));
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
}: PlaceComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [focus, setFocus] = useState<LatLng>({ lat: 10.779, lng: 106.701 });
  const [resolving, setResolving] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const selectionRef = useRef<AbortController | null>(null);
  useEffect(() => { selectionRef.current?.abort(); setResolving(false); setSelectionError(''); }, [value]);
  useEffect(() => () => selectionRef.current?.abort(), []);
  const { results: remotePlaces, status, error: searchError } = usePlaceSearch(value, focus, open);

  // Gộp địa điểm có sẵn (ưu tiên) với kết quả từ API, bỏ trùng và giới hạn số lượng.
  const matches = useMemo(() => {
    const query = normalize(value);
    if (query.length < MIN_QUERY_LENGTH) return [];
    const local = places.filter((place) => normalize(`${place.name} ${place.address} ${place.category}`).includes(query));
    const remainingLocal = local.filter((place) => !remotePlaces.some((candidate) => isSamePlace(place, candidate)));
    return [...remotePlaces, ...remainingLocal].slice(0, maxSuggestions);
  }, [maxSuggestions, places, remotePlaces, value]);

  const showList = open && value.trim().length >= MIN_QUERY_LENGTH;

  const choose = async (suggestion: PlaceSearchSuggestion) => {
    selectionRef.current?.abort();
    const controller = new AbortController(); selectionRef.current = controller;
    setResolving(true); setSelectionError('');
    try {
      const place = await placeApi.resolve(suggestion, controller.signal);
      if (controller.signal.aborted) return;
      onChange(place.name); onSelect(place); setOpen(false);
    } catch (cause) {
      if (!controller.signal.aborted) setSelectionError(cause instanceof Error ? cause.message : 'Không lấy được tọa độ địa điểm.');
    } finally { if (!controller.signal.aborted) setResolving(false); }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { setOpen(false); selectionRef.current?.abort(); setResolving(false); }
    if (resolving) { if (event.key === 'Enter') event.preventDefault(); return; }
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
  const emptyMessage = status === 'loading'
    ? 'Đang tìm địa điểm…'
    : status === 'error'
      ? searchError || 'Không kết nối được dịch vụ tìm kiếm. Thử lại hoặc chọn trên bản đồ.'
      : 'Không tìm thấy địa điểm. Thử tên hoặc địa chỉ khác.';

  return (
    <div className={`relative ${className}`}>
      {icon && <Icon name={icon} size={18} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400" />}
      <input
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showList && matches.length > 0}
        aria-activedescendant={showList && matches[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        className={`h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100 ${icon ? 'pl-10' : 'pl-3'} pr-3 ${inputClassName}`}
        onBlur={() => window.setTimeout(() => setOpen(false), 100)}
        onChange={(event) => {
          selectionRef.current?.abort(); setResolving(false); setSelectionError('');
          if (getFocus) setFocus(getFocus());
          onChange(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => { if (getFocus) setFocus(getFocus()); setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        value={value}
      />
      {selectionError && <p role="alert" className="mt-1 text-xs text-amber-800">{selectionError}</p>}
      {showList && (
        <div id={listId} className="absolute left-0 right-0 top-[calc(100%+7px)] z-[80] overflow-hidden rounded-2xl border border-slate-100 bg-white p-1.5 shadow-float" role="listbox">
          {matches.length > 0 ? matches.map((place, index) => (
            <button
              key={place.id}
              id={`${listId}-${index}`}
              type="button"
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 focus:outline-none ${index === activeIndex ? 'bg-slate-50' : ''}`}
              onMouseDown={(event) => event.preventDefault()} // giữ focus ở input khi click
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => { void choose(place); }}
              disabled={resolving}
              role="option"
              aria-selected={index === activeIndex}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon name="pin" size={17} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">{place.name}</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">{place.address}</span>
              </span>
              <Icon name="arrow-up-right" size={15} className="shrink-0 text-slate-400" />
            </button>
          )) : <p className="px-3 py-3 text-xs leading-5 text-slate-500">{emptyMessage}</p>}
          {status === 'error' && matches.length > 0 && <p role="alert" className="px-3 py-2 text-xs text-amber-800">{emptyMessage}</p>}
          <div role="status" className="border-t border-slate-100 px-3 py-2 text-[10px] font-medium text-slate-400">
            {resolving ? 'Đang lấy tọa độ địa điểm…' : status === 'loading' ? 'Đang tìm thêm…' : remotePlaces.some((place) => place.source === 'vietmap') ? 'VietMap · ưu tiên gần khu vực tìm kiếm' : 'Địa điểm gợi ý có sẵn'}
          </div>
        </div>
      )}
    </div>
  );
}
