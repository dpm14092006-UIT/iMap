import { useState } from 'react';
import { popularPlaces } from '../data/popularPlaces';
import type { LatLng, Place } from '../types';
import { PlaceCombobox } from './PlaceCombobox';

type PlaceSearchBarProps = { getFocus?: () => LatLng; onSelect: (place: Place) => void };

/** Thanh tìm kiếm trên header: chọn địa điểm để xem chi tiết trên bản đồ. */
export function PlaceSearchBar({ onSelect, getFocus }: PlaceSearchBarProps) {
  const [query, setQuery] = useState('');

  return (
    <PlaceCombobox
      getFocus={getFocus}
      ariaLabel="Tìm địa điểm trên bản đồ"
      className="w-full"
      icon="search"
      inputClassName="h-11 rounded-full border-transparent bg-slate-100/90 text-[13px] shadow-none focus:border-brand-500 focus:bg-white sm:h-12 sm:text-sm"
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
  );
}
