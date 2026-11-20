import { useEffect, useRef, useState } from 'react';
import { RequestGeneration } from '../../../shared/async/RequestGeneration';
import { useI18n } from '../../../shared/i18n/I18nProvider';
import type { Place } from '../../places/types';
import type { RouteObjective, RoutePlan, TransportMode } from '../../routing/types';
import { MAX_STOPS } from '../domain/limits';
import { isSamePoint } from '../domain/samePoint';
import type { LocalizedMessage, MultiStopPanelProps } from '../types';

export function useMultiStopForm({ isActive, onShowPlan, onPlanRoute, onReset }: MultiStopPanelProps) {
  const requests = useRef(new RequestGeneration());
  const pending = useRef(false);
  const { language, t } = useI18n();
  const [stops, setStops] = useState<Place[]>([]);
  const [start, setStart] = useState<Place | null>(null);
  const [startText, setStartText] = useState('');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<TransportMode>('motorcycle');
  const [returnToStart, setReturnToStart] = useState(false);
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [error, setError] = useState<LocalizedMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [objective, setObjective] = useState<RouteObjective>('time');

  useEffect(() => {
    requests.current.invalidate();
    pending.current = false;
    setIsLoading(false);
  }, [start, stops, mode, objective, returnToStart]);
  useEffect(() => {
    const generation = requests.current;
    return () => generation.invalidate();
  }, []);
  useEffect(() => {
    if (isActive && plan) onShowPlan(plan);
  }, [isActive, plan, onShowPlan]);

  const addStop = (place: Place) => {
    if (stops.length >= MAX_STOPS) {
      setError({ source: 'Tối đa {count} điểm cần ghé.', values: { count: MAX_STOPS } });
      return;
    }
    if ([...(start ? [start] : []), ...stops].some((item) => isSamePoint(item, place))) {
      setError({ source: 'Điểm này đã có trong hành trình.' });
      return;
    }
    setStops((current) =>
      current.some((item) => item.id === place.id) ? current : [...current, place].slice(0, MAX_STOPS),
    );
    setQuery('');
    setPlan(null);
    setError(null);
  };

  const selectStart = (place: Place) => {
    if (stops.some((stop) => isSamePoint(stop, place))) {
      setError({ source: 'Điểm xuất phát trùng một điểm cần ghé.' });
      return;
    }
    setStart(place);
    setStartText(place.name);
    setPlan(null);
    setError(null);
  };

  const reset = () => {
    requests.current.invalidate();
    pending.current = false;
    setIsLoading(false);
    onReset(plan?.id);
    setStart(null);
    setStartText('');
    setStops([]);
    setQuery('');
    setPlan(null);
    setError(null);
  };

  /** Gửi các điểm lên API tối ưu; thứ tự trả về được ghi lại vào danh sách điểm cần ghé. */
  const optimize = async () => {
    if (pending.current) return;
    if (!start) {
      setError({ source: 'Hãy chọn điểm xuất phát từ gợi ý.' });
      return;
    }
    const ticket = requests.current.begin();
    pending.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const result = await onPlanRoute(start, stops, mode, objective, returnToStart);
      if (!ticket.isCurrent()) return;
      if ('error' in result) {
        setError({ source: result.error });
        setPlan(null);
      } else {
        setPlan(result);
        setStops(result.stops.slice(1, returnToStart ? -1 : undefined));
      }
    } catch {
      if (ticket.isCurrent()) setError({ source: 'Không tính được hành trình. Hãy thử lại.' });
    } finally {
      if (ticket.isCurrent()) {
        pending.current = false;
        setIsLoading(false);
      }
    }
  };
  return {
    language,
    t,
    stops,
    setStops,
    start,
    setStart,
    startText,
    setStartText,
    query,
    setQuery,
    mode,
    setMode,
    returnToStart,
    setReturnToStart,
    plan,
    setPlan,
    error,
    isLoading,
    objective,
    setObjective,
    addStop,
    selectStart,
    reset,
    optimize,
  };
}
