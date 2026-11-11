import { useCallback, useState } from 'react';
import type { LatLng } from '../../places/types';

export type LocationFix = { point: LatLng; accuracyMeters: number };

/** Đổi mã lỗi Geolocation của trình duyệt sang thông báo tiếng Việt. */
function geolocationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED)
    return 'Không lấy được vị trí. Hãy cấp quyền định vị cho trình duyệt.';
  if (error.code === error.TIMEOUT) return 'Định vị quá lâu. Hãy thử lại ở nơi thoáng hơn.';
  return 'Không xác định được vị trí hiện tại.';
}

/**
 * Lấy vị trí GPS hiện tại của thiết bị.
 * `locate()` trả Promise để nơi gọi có thể dùng vị trí ngay (vd. đặt làm điểm xuất phát).
 */
export function useCurrentLocation() {
  const [location, setLocation] = useState<LatLng | null>(null);

  const locate = useCallback(
    () =>
      new Promise<LocationFix>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Thiết bị này không hỗ trợ định vị.'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const point = { lat: position.coords.latitude, lng: position.coords.longitude };
            setLocation(point);
            resolve({ point, accuracyMeters: Math.round(position.coords.accuracy) });
          },
          (error) => reject(new Error(geolocationErrorMessage(error))),
          { enableHighAccuracy: true, timeout: 9000 },
        );
      }),
    [],
  );

  return { location, locate };
}
