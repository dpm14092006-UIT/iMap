import { useEffect, useState } from 'react';
import { placeApi } from '../api/placeApi';
import type { LatLng, Place } from '../types';

/** Trạng thái tìm kiếm để UI hiển thị đúng thông báo (đang tìm / không có / lỗi). */
export type PlaceSearchStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Chờ người dùng ngừng gõ bao lâu (ms) thì mới gọi API. */
const DEBOUNCE_MS = 350;
/** Tối thiểu số ký tự trước khi tìm kiếm. */
export const MIN_QUERY_LENGTH = 2;
/** Mặc định ưu tiên kết quả quanh trung tâm TP.HCM. */
const HCMC_CENTER: LatLng = { lat: 10.779, lng: 106.701 };

/**
 * Tìm địa điểm từ backend với debounce và hủy request cũ.
 * - Gõ liên tục: chỉ gọi API sau khi dừng gõ DEBOUNCE_MS.
 * - Gõ tiếp khi request cũ chưa xong: request cũ bị abort, không ghi đè kết quả mới.
 */
export function usePlaceSearch(query: string, focus: LatLng = HCMC_CENTER) {
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<PlaceSearchStatus>('idle');
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setStatus('idle');
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus('loading');
      try {
        setResults(await placeApi.suggest(trimmed, focus, controller.signal));
        setStatus('ready');
      } catch {
        if (controller.signal.aborted) return; // request bị hủy do người dùng gõ tiếp
        setResults([]);
        setStatus('error');
      }
    }, DEBOUNCE_MS);

    // Cleanup chạy mỗi khi query đổi: hủy hẹn giờ và request đang chạy.
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // Phụ thuộc vào lat/lng thay vì object focus để không gọi lại khi object được tạo mới.
  }, [trimmed, focus.lat, focus.lng]);

  return { results, status };
}
