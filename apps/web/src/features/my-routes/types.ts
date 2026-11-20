import type { RouteObjective, RoutePlan, TransportMode } from '../map/types';
import type { Place } from '../places/types';

export type SavedRoute = {
  id: string;
  kind: 'route' | 'multi';
  title: string;
  origin: Place;
  destination?: Place;
  stops?: Place[];
  vehicle: TransportMode;
  /** Tiêu chí (nhanh nhất / ngắn nhất) để tính lại đúng như lúc lưu. */
  objective?: RouteObjective;
  /**
   * Chỉ có ở dữ liệu cũ: trước đây lưu cả tuyến (kèm hình học) nên localStorage nhanh đầy.
   * Giờ không lưu nữa vì khi mở lại luôn tính lại tuyến; khi đọc chỉ lấy `objective` rồi bỏ đi.
   */
  plan?: RoutePlan;
  originId: string;
  originName: string;
  destinationId: string;
  destinationName: string;
};
