import { useEffect, useId, useMemo, useState } from 'react';
import { Icon, type IconName } from '../../../shared/components/Icon';
import type { DemoPlace } from '../../map/types';

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

type PlaceComboboxProps = {
  value: string;
  places: DemoPlace[];
  onChange: (value: string) => void;
  onSelect: (place: DemoPlace) => void;
  placeholder: string;
  icon?: IconName | null;
  className?: string;
  inputClassName?: string;
  ariaLabel: string;
  maxSuggestions?: number;
};

export function PlaceCombobox({
  value,
  places,
  onChange,
  onSelect,
  placeholder,
  icon = 'search',
  className = '',
  inputClassName = '',
  ariaLabel,
  maxSuggestions = 5,
}: PlaceComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [remotePlaces, setRemotePlaces] = useState<DemoPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [remoteAvailable, setRemoteAvailable] = useState(true);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      setRemotePlaces([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        // Photon does not support Vietnamese as a `lang` response value; omit it so Vietnamese names still resolve.
        const params = new URLSearchParams({ q: query, lat: '10.779', lng: '106.701' });
        const response = await fetch(`/api/places/suggest?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Place search unavailable');
        const result = await response.json() as { data?: { id: string; name: string; address: string; lat?: number; lng?: number }[] };
        setRemotePlaces((result.data ?? []).flatMap((place): DemoPlace[] => typeof place.lat === 'number' && typeof place.lng === 'number'
          ? [{ id: place.id, name: place.name, district: place.address, category: 'Địa chỉ', lat: place.lat, lng: place.lng, source: 'Photon / OpenStreetMap' }]
          : []));
        setRemoteAvailable(true);
      } catch (error) {
        if (controller.signal.aborted) return;
        setRemotePlaces([]);
        setRemoteAvailable(false);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const matches = useMemo(() => {
    const query = normalize(value);
    if (query.length < 2) return [];
    const local = places.filter((place) => normalize(`${place.name} ${place.district} ${place.category}`).includes(query));
    const combined = [...local, ...remotePlaces.filter((remote) => !local.some((place) => normalize(place.name) === normalize(remote.name) && Math.abs(place.lat - remote.lat) < 0.004 && Math.abs(place.lng - remote.lng) < 0.004))];
    return combined.slice(0, maxSuggestions);
  }, [maxSuggestions, places, remotePlaces, value]);

  const choose = (place: DemoPlace) => {
    onChange(place.name);
    onSelect(place);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      {icon && <Icon name={icon} size={18} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400" />}
      <input
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open && matches.length > 0}
        autoComplete="off"
        className={`h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100 ${icon ? 'pl-10' : 'pl-3'} pr-3 ${inputClassName}`}
        onBlur={() => window.setTimeout(() => setOpen(false), 100)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'Enter' && open && matches[0]) {
            event.preventDefault();
            choose(matches[0]);
          }
        }}
        placeholder={placeholder}
        role="combobox"
        value={value}
      />
      {open && value.trim().length >= 2 && (
        <div id={listId} className="absolute left-0 right-0 top-[calc(100%+7px)] z-[80] overflow-hidden rounded-2xl border border-slate-100 bg-white p-1.5 shadow-float" role="listbox">
          {matches.length > 0 ? matches.map((place) => (
            <button
              key={place.id}
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(place)}
              role="option"
              aria-selected={false}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon name="pin" size={17} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">{place.name}</span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-500">{place.category} · {place.district}</span>
              </span>
              <Icon name="arrow-up-right" size={15} className="shrink-0 text-slate-400" />
            </button>
          )) : <p className="px-3 py-3 text-xs leading-5 text-slate-500">{searching ? 'Đang tìm địa điểm trên OpenStreetMap…' : remoteAvailable ? 'Không tìm thấy địa điểm. Thử tên hoặc địa chỉ khác.' : 'Không thể kết nối Photon lúc này. Bạn vẫn có thể chọn các địa điểm TP.HCM có sẵn.'}</p>}
          <div className="border-t border-slate-100 px-3 py-2 text-[10px] font-medium text-slate-400">{searching ? 'Đang tìm thêm…' : matches.some((place) => place.source === 'Photon / OpenStreetMap') ? 'Kết quả từ Photon / OpenStreetMap' : 'OpenStreetMap · địa điểm TP. Hồ Chí Minh'}</div>
        </div>
      )}
    </div>
  );
}
