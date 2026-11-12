import { useEffect, useState } from 'react';
import { popularPlaces } from '../data/popularPlaces';
import type { LatLng, Place } from '../types';
import { PlaceCombobox } from './PlaceCombobox';

type PlaceFieldProps = {
  /** Địa điểm đang được chọn (null khi người dùng đang gõ / chưa chọn). */
  getFocus?: () => LatLng;
  place: Place | null;
  onChange: (place: Place | null) => void;
  ariaLabel: string;
  placeholder: string;
};

/**
 * Ô chọn một địa điểm. Khác PlaceCombobox ở chỗ giá trị là `Place` chứ không phải chuỗi:
 * - Khi `place` đổi từ bên ngoài (click bản đồ, GPS, đảo chiều) thì ô tự hiện tên mới.
 * - Khi người dùng gõ chữ thì địa điểm cũ bị bỏ chọn (onChange(null)) cho tới khi chọn gợi ý.
 */
export function PlaceField({ place, onChange, ariaLabel, placeholder, getFocus }: PlaceFieldProps) {
  const [text, setText] = useState(place?.name ?? '');

  useEffect(() => {
    if (place) setText(place.name);
  }, [place]);

  return (
    <PlaceCombobox
      getFocus={getFocus}
      ariaLabel={ariaLabel}
      icon={null}
      inputClassName="h-[46px] bg-white dark:bg-slate-800 pl-3"
      onChange={(value) => {
        setText(value);
        if (place) onChange(null);
      }}
      onSelect={onChange}
      places={popularPlaces}
      placeholder={placeholder}
      value={text}
    />
  );
}
