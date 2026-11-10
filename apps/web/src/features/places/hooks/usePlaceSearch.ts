import { useEffect, useState } from 'react';
import { placeApi } from '../api/placeApi';
import type { LatLng, PlaceSearchSuggestion } from '../types';

/** Trạng thái tìm kiếm để UI hiển thị đúng thông báo (đang tìm / không có / lỗi). */
export type PlaceSearchStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Chờ người dùng ngừng gõ bao lâu (ms) thì mới gọi API. */
const DEBOUNCE_MS = 300;
/** Tối thiểu số ký tự trước khi tìm kiếm. */
export const MIN_QUERY_LENGTH = 2;
/** Mặc định ưu tiên kết quả quanh trung tâm TP.HCM. */
const HCMC_CENTER: LatLng = { lat: 10.779, lng: 106.701 };

/**
 * Tìm địa điểm từ backend với debounce và hủy request cũ.
 * - Gõ liên tục: chỉ gọi API sau khi dừng gõ DEBOUNCE_MS.
 * - Gõ tiếp khi request cũ chưa xong: request cũ bị abort, không ghi đè kết quả mới.
 */
export function usePlaceSearch(query: string, focus: LatLng = HCMC_CENTER, enabled = true) {
  const [results, setResults] = useState<PlaceSearchSuggestion[]>([]);
  const [status, setStatus] = useState<PlaceSearchStatus>('idle');
  const trimmed = query.trim();
  const requestKey = `${trimmed}|${focus.lat}|${focus.lng}`;
  const [completedQuery, setCompletedQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled || trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setStatus('idle');
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setResults([]); setError(''); setStatus('loading');
      try {
        const found = await placeApi.suggest(trimmed, focus, controller.signal);
        if (controller.signal.aborted) return;
        setResults(found);
        setCompletedQuery(requestKey); setStatus('ready');
      } catch (cause) {
        if (controller.signal.aborted) return; // request bị hủy do người dùng gõ tiếp
        setResults([]);
        setCompletedQuery(requestKey); setError(cause instanceof Error ? cause.message : 'Không kết nối được dịch vụ tìm kiếm.'); setStatus('error');
      }
    }, DEBOUNCE_MS);

    // Cleanup chạy mỗi khi query đổi: hủy hẹn giờ và request đang chạy.
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // Phụ thuộc vào lat/lng thay vì object focus để không gọi lại khi object được tạo mới.
  }, [trimmed, focus.lat, focus.lng, enabled, requestKey]);

  return { results: completedQuery === requestKey ? results : [], status: trimmed.length < MIN_QUERY_LENGTH ? 'idle' as const : completedQuery !== requestKey ? 'loading' as const : status, error: completedQuery === requestKey ? error : '' };
}
