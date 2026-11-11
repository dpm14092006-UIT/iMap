import type { PathfindingResult } from '@routetwin/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AlgorithmOverlay, Bounds, TransportMode } from '../../map/types';
import type { Place } from '../../places/types';
import { pathfindingApi } from '../services/pathfindingApi';

export type AlgorithmObjective = 'distance' | 'duration';

type ComparisonInput = { origin: Place | null; destination: Place | null; vehicle: TransportMode };

/**
 * Chạy Dijkstra và A* trên backend cho cùng điểm đi/đến để so sánh.
 * Kết quả tự xóa khi điểm đi, điểm đến hoặc loại xe thay đổi (vì không còn đúng nữa).
 */
export function useAlgorithmComparison({ origin, destination, vehicle }: ComparisonInput) {
  const [objective, setObjective] = useState<AlgorithmObjective>('distance');
  const [result, setResult] = useState<PathfindingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  /** Vùng có dữ liệu đồ thị, lấy 1 lần ở lần chạy đầu tiên để vẽ khung trên bản đồ. */
  const [coverage, setCoverage] = useState<Bounds | null>(null);
  const latestRequest = useRef(0);

  // Đầu vào đổi → bỏ kết quả cũ và hủy kết quả đang chờ.
  useEffect(() => {
    latestRequest.current += 1;
    setResult(null);
    setError('');
    setIsLoading(false);
  }, [origin?.id, destination?.id, vehicle, objective]);

  const run = async () => {
    if (!origin || !destination) {
      setError('Hãy chọn điểm đi và điểm đến.');
      return;
    }
    const requestId = ++latestRequest.current;
    setIsLoading(true);
    setError('');
    if (!coverage)
      pathfindingApi
        .graphInfo()
        .then((info) => setCoverage(info.coverage))
        .catch(() => {
          /* không bắt buộc */
        });
    try {
      const data = await pathfindingApi.solve({
        from: { lat: origin.lat, lng: origin.lng },
        to: { lat: destination.lat, lng: destination.lng },
        vehicle,
        objective,
        algorithms: ['dijkstra', 'astar'],
      });
      if (requestId === latestRequest.current) setResult(data);
    } catch (caught) {
      if (requestId === latestRequest.current)
        setError(caught instanceof Error ? caught.message : 'Không chạy được thuật toán.');
    } finally {
      if (requestId === latestRequest.current) setIsLoading(false);
    }
  };

  /**
   * Dữ liệu để bản đồ vẽ: tuyến của từng thuật toán (đổi GeoJSON [lng,lat] sang Leaflet [lat,lng])
   * và khung vùng dữ liệu. Vẫn hiện khung khi lỗi để người dùng biết vùng nào chạy được.
   */
  const overlay = useMemo<AlgorithmOverlay | null>(() => {
    if (!result && !(error && coverage)) return null;
    return {
      key: result
        ? `${result.snappedFrom.lat},${result.snappedFrom.lng}-${result.snappedTo.lat},${result.snappedTo.lng}-${result.vehicle}-${result.objective}`
        : 'coverage-only',
      paths: (result?.runs ?? []).map((run) => ({
        algorithm: run.algorithm,
        points: run.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
      })),
      coverage,
    };
  }, [result, error, coverage]);

  return { objective, setObjective, result, isLoading, error, overlay, run };
}

export type AlgorithmComparisonController = ReturnType<typeof useAlgorithmComparison>;
