import { useState } from 'react';
import { demoPlaces } from '../../map/data/demoPlaces';
import type { DemoPlace } from '../../map/types';
import { PlaceCombobox } from './PlaceCombobox';

type PlaceSearchBarProps = { onSelect: (place: DemoPlace) => void };

export function PlaceSearchBar({ onSelect }: PlaceSearchBarProps) {
  const [query, setQuery] = useState('');

  return (
    <PlaceCombobox
      ariaLabel="Tìm địa điểm trên bản đồ"
      className="w-full"
      icon="search"
      inputClassName="h-11 rounded-full border-transparent bg-slate-100/90 text-[13px] shadow-none focus:border-brand-500 focus:bg-white sm:h-12 sm:text-sm"
      maxSuggestions={6}
      onChange={setQuery}
      onSelect={(place) => {
        setQuery(place.name);
        onSelect(place);
      }}
      places={demoPlaces}
      placeholder="Tìm địa điểm ở TP. Hồ Chí Minh"
      value={query}
    />
  );
}
