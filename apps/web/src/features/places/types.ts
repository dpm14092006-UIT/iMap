/**
 * Nguồn gốc của một địa điểm, dùng để hiển thị nhãn phù hợp trên UI.
 * - popular: địa điểm gợi ý có sẵn trong app (xem data/popularPlaces.ts)
 * - osm:     kết quả tìm kiếm từ Photon / OpenStreetMap
 * - map:     điểm người dùng chọn trực tiếp trên bản đồ
 * - gps:     vị trí hiện tại lấy từ GPS của thiết bị
 */
export type PlaceSource = 'popular' | 'osm' | 'vietmap' | 'map' | 'gps';

/** Một địa điểm dùng chung cho tìm kiếm, chỉ đường, nhiều điểm và tuyến đã lưu. */
export type Place = {
  id: string;
  name: string;
  /** Địa chỉ hoặc quận/huyện, hiển thị dòng phụ dưới tên. */
  address: string;
  /** Loại địa điểm (Công viên, Chợ, Địa chỉ…). */
  category: string;
  lat: number;
  lng: number;
  source: PlaceSource;
};

/** Tọa độ đơn giản theo định dạng JSON của dự án: {lat, lng}. */
export type LatLng = { lat: number; lng: number };

/** A suggestion may need one details request before it can be used as a route point. */
export type PlaceSearchSuggestion = Omit<Place, 'lat' | 'lng'> & { lat?: number; lng?: number };
