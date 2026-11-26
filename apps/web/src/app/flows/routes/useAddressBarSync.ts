import { useEffect } from 'react';
import { addressBarUrl, type AddressBarState } from '../../../features/routing/domain/routeShareLink';

/**
 * Cập nhật thanh địa chỉ theo tuyến / địa điểm đang xem (replaceState: không thêm mục lịch sử),
 * để sao chép URL của trình duyệt cũng gửi được đúng thứ đang xem, như nút "Sao chép liên kết".
 * Link chia sẻ lúc mở trang đã được đọc khi khởi tạo, nên việc tạm bỏ tham số trước khi tuyến/địa điểm
 * được áp dụng không làm mất gì: ngay sau đó URL được dựng lại từ trạng thái mới.
 */
export function useAddressBarSync(state: AddressBarState) {
  const key = JSON.stringify(state);
  useEffect(() => {
    const next = addressBarUrl(JSON.parse(key) as AddressBarState, window.location.href);
    if (next !== window.location.href) window.history.replaceState(window.history.state, '', next);
  }, [key]);
}
