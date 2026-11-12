import type { PoiCategory } from '@routetwin/shared';
import { mapWithConcurrency } from '../../../../shared/async/mapWithConcurrency.js';
import { normalizeText, type LatLng } from '../../domain/poi-geometry.js';
import { matchesQueryName } from '../../domain/poi-relevance.js';
import { categoryFromCodes, poiCategorySearchTerms } from '../poi-category-catalog.js';
import type { PoiCandidate, PoiSearchProvider } from '../ports/PoiSearchProvider.js';

const SEARCH_CONCURRENCY = 4;
const LOCATE_CONCURRENCY = 5;

export type PoiSearchTerm = { query?: string | undefined; category?: PoiCategory | undefined };

export type LocatedPoi = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: PoiCategory | null;
  categoryCodes: string[];
};

const dedupeKey = (candidate: PoiCandidate) =>
  `${normalizeText(candidate.name)}|${normalizeText(candidate.address)}`;

/**
 * Bước chung của "dọc tuyến" và "quanh đây": gọi tìm kiếm tại từng điểm mẫu (song song có giới hạn),
 * khử trùng, chọn tối đa `limit` kết quả rồi mới lấy toạ độ (tốn phí) cho đúng số đó.
 */
export class PoiLookup {
  constructor(private readonly provider: PoiSearchProvider) {}

  async find(
    samples: readonly LatLng[],
    term: PoiSearchTerm,
    radiusM: number,
    limit: number,
  ): Promise<LocatedPoi[]> {
    const preset = term.category ? poiCategorySearchTerms[term.category] : undefined;
    const text = term.query?.trim() || preset?.keyword || '';
    const categoryCodes = preset?.categoryCodes ?? [];
    // Chỉ lọc độ liên quan cho truy vấn tự do; tìm theo danh mục giữ nguyên kết quả của nhà cung cấp.
    const freeText = term.query?.trim() || '';

    const searched = await mapWithConcurrency(samples, SEARCH_CONCURRENCY, (center) =>
      this.provider.search({ text, center, radiusM, categoryCodes }),
    );
    const failure = searched.find((item) => !item.ok);
    if (failure && !searched.some((item) => item.ok)) throw (failure as { error: unknown }).error;

    // Mỗi điểm mẫu: bỏ kết quả quá xa tâm mẫu, rồi xếp theo khoảng cách.
    const lists = searched.map((item) =>
      item.ok
        ? item.value
            .filter((candidate) => candidate.distanceM === undefined || candidate.distanceM <= radiusM * 1.1)
            // Lọc theo tên TRƯỚC khi lấy toạ độ (Place v4 tính phí theo lượt gọi).
            .filter((candidate) => !freeText || matchesQueryName(candidate.name, freeText))
            .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity))
        : [],
    );

    // Xen kẽ giữa các điểm mẫu để `limit` nhỏ vẫn phủ cả tuyến thay vì chỉ lấy đoạn đầu.
    const chosen: PoiCandidate[] = [];
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    for (let round = 0; chosen.length < limit && lists.some((list) => round < list.length); round++) {
      for (const list of lists) {
        const candidate = list[round];
        if (!candidate || chosen.length >= limit) continue;
        const key = dedupeKey(candidate);
        if (seenIds.has(candidate.id) || seenKeys.has(key)) continue;
        seenIds.add(candidate.id);
        seenKeys.add(key);
        chosen.push(candidate);
      }
    }

    const located = await mapWithConcurrency(chosen, LOCATE_CONCURRENCY, (candidate) =>
      this.provider.locate(candidate.id),
    );
    const locateFailure = located.find((item) => !item.ok);
    if (locateFailure && !located.some((item) => item.ok)) throw (locateFailure as { error: unknown }).error;

    const result: LocatedPoi[] = [];
    located.forEach((item, index) => {
      if (!item.ok) return;
      const candidate = chosen[index]!;
      result.push({
        id: candidate.id,
        name: candidate.name || item.value.name,
        address: item.value.address || candidate.address,
        lat: item.value.lat,
        lng: item.value.lng,
        category: categoryFromCodes(candidate.categoryCodes, term.category),
        categoryCodes: candidate.categoryCodes,
      });
    });
    return result;
  }
}
