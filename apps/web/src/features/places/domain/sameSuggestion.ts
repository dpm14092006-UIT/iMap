import { foldVietnamese } from '../../../shared/text/foldVietnamese';
import type { PlaceSearchSuggestion } from '../types';
/** Match identity, or the same normalized name and address. */
export function isSamePlace(a: PlaceSearchSuggestion, b: PlaceSearchSuggestion) {
  return (
    a.id === b.id ||
    (foldVietnamese(a.name) === foldVietnamese(b.name) &&
      foldVietnamese(a.address) === foldVietnamese(b.address))
  );
}
