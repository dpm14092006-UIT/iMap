import { foldVietnamese } from '../../../shared/text/foldVietnamese';
import type { PlaceSearchSuggestion } from '../types';
import { isSamePlace } from './sameSuggestion';

/**
 * Gộp gợi ý có sẵn trong app với kết quả VietMap, bỏ trùng và giới hạn số lượng.
 * Gợi ý có sẵn khớp theo TÊN (vd. "Hoàng Sa" → Quần đảo Hoàng Sa) đứng trước kết quả VietMap để không bị
 * đẩy khỏi danh sách khi kết quả mạng về; khớp chỉ theo địa chỉ/loại thì xếp sau.
 */
export function mergeSuggestions(
  query: string,
  local: readonly PlaceSearchSuggestion[],
  remote: readonly PlaceSearchSuggestion[],
  max: number,
): PlaceSearchSuggestion[] {
  const folded = foldVietnamese(query);
  const matching = local.filter((place) =>
    foldVietnamese(`${place.name} ${place.address} ${place.category}`).includes(folded),
  );
  const remaining = matching.filter((place) => !remote.some((candidate) => isSamePlace(place, candidate)));
  const byName = remaining.filter((place) => foldVietnamese(place.name).includes(folded));
  const byOther = remaining.filter((place) => !byName.includes(place));
  return [...byName, ...remote, ...byOther].slice(0, max);
}
