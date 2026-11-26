/**
 * Nguồn gốc của một địa điểm, dùng để hiển thị nhãn phù hợp trên UI.
 * - popular: địa điểm gợi ý có sẵn trong app (xem data/popularPlaces.ts)
 * - osm:     địa điểm từ trợ lý địa điểm (dữ liệu OpenStreetMap qua Overpass)
 * - vietmap: kết quả tìm kiếm VietMap
 * - map:     điểm người dùng chọn trực tiếp trên bản đồ
 * - gps:     vị trí hiện tại lấy từ GPS của thiết bị
 * - poi:     địa điểm thật (VietMap) từ chức năng khám phá quanh đây / dọc tuyến
 */
export type PlaceSource = 'popular' | 'osm' | 'vietmap' | 'map' | 'gps' | 'poi';

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

/** A suggestion may need one details request before it can be used as a route point. */
export type PlaceSearchSuggestion = Omit<Place, 'lat' | 'lng'> & { lat?: number; lng?: number };

import { type Ref } from 'react';
import type { LatLng } from '../../shared/geo/types';
import { type IconName } from '../../shared/ui/Icon';

export type ComboboxAction = {
  label: string;
  icon: IconName;
  /**
   * true: Enter luôn chạy dòng này (từ khóa khớp danh mục). false: chỉ khi không có địa điểm nào
   * chứa đúng chữ đã gõ (có dấu), vd. "phở" không khớp "Đường Phó Đức Chính".
   */
  preferred: boolean;
  onRun: () => void;
};
export type PlaceComboboxProps = {
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
  /** Lớp định vị danh sách gợi ý thay cho mặc định (ngay dưới ô nhập). */
  listPositionClassName?: string;
  ariaLabel: string;
  maxSuggestions?: number;
  /** Để nơi dùng focus ô nhập bằng phím tắt. */
  inputRef?: Ref<HTMLInputElement>;
  /** Dòng thao tác đầu danh sách, dựng từ nội dung đang gõ; null thì không có. */
  action?: ComboboxAction | null;
  /** Điểm đã dùng gần đây (đã đăng nhập), hiện khi ô trống hoặc chưa sửa tên điểm đang chọn. */
  recentPlaces?: Place[];
  recentActive?: boolean;
  onRemoveRecent?: (place: Place) => void;
};
