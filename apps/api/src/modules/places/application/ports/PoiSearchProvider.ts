import type { GeoFocus } from './PlaceSearchProvider.js';

export type PoiSearchRequest = {
  text: string;
  center: GeoFocus;
  radiusM: number;
  /** Mã danh mục của nhà cung cấp; rỗng là không giới hạn danh mục. */
  categoryCodes: readonly string[];
};

/** Kết quả tìm kiếm chưa có toạ độ: chỉ có tham chiếu mờ `id` để lấy toạ độ sau. */
export type PoiCandidate = {
  id: string;
  name: string;
  address: string;
  categoryCodes: string[];
  /** Khoảng cách tới tâm tìm kiếm (mét), nếu nhà cung cấp trả về. */
  distanceM: number | undefined;
};

export type PoiLocation = { id: string; name: string; address: string; lat: number; lng: number };

/** Port tìm địa điểm theo từ khóa quanh một tâm. Use case không biết nhà cung cấp cụ thể. */
export interface PoiSearchProvider {
  search(request: PoiSearchRequest): Promise<PoiCandidate[]>;
  /** Lấy toạ độ thật của một kết quả (có thể tính phí theo lượt). */
  locate(id: string): Promise<PoiLocation>;
}
