import { stopCategoryLabels, type ExplorePlacesResponse, type StopCategory } from '@routetwin/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useI18n } from '../../../shared/i18n/I18nProvider';
import { assistantApi } from '../api/assistantApi';
import type { PlaceAssistantPanelProps, Point } from '../types';
const exampleRequests = {
  vi: ['Tôi cần đổ xăng', 'Tìm trường học gần đây', 'Tìm nhà ga', 'Tôi cần nghỉ một chút'],
  en: ["I'm running low on fuel", 'Find a school nearby', 'Find the station', 'I need a break'],
};
export function usePlaceAssistant({
  accessToken,
  route,
  selectedPoint,
  getMapCenter,
}: PlaceAssistantPanelProps) {
  const { language: uiLanguage, t } = useI18n();
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [inputMode, setInputMode] = useState<'actions' | 'text'>('actions');
  const [query, setQuery] = useState('');
  const [context, setContext] = useState<string[]>([]);
  const [mode, setMode] = useState<'nearby' | 'route'>(route?.stops.length === 2 ? 'route' : 'nearby');
  const [center, setCenter] = useState<Point>(() => selectedPoint ?? getMapCenter());
  const [category, setCategory] = useState<StopCategory | ''>('');
  const [radius, setRadius] = useState('');
  const [distance, setDistance] = useState('');
  const [minutes, setMinutes] = useState('');
  const [result, setResult] = useState<ExplorePlacesResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requestRef = useRef<AbortController | null>(null);

  const examples = exampleRequests[uiLanguage];

  const numberLocale = uiLanguage === 'en' ? 'en-US' : 'vi-VN';

  const routeId = route?.id;

  useEffect(() => {
    const controller = new AbortController();
    setAiConfigured(null);
    void assistantApi
      .routeStopsConfig(controller.signal, accessToken)
      .then((config) => {
        if (!controller.signal.aborted) setAiConfigured(config.aiConfigured);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [accessToken]);

  useEffect(() => {
    requestRef.current?.abort();
    setLoading(false);
    setResult(null);
    setError('');
  }, [accessToken, routeId, mode, center.lat, center.lng]);

  useEffect(() => {
    if (selectedPoint) setCenter(selectedPoint);
  }, [selectedPoint]);

  useEffect(() => () => requestRef.current?.abort(), []);

  /** Hủy lượt tìm đang chạy (kết quả về sau bị bỏ qua). */
  const cancelSearch = () => {
    requestRef.current?.abort();
    setLoading(false);
  };

  const submit = async (chosenCategory?: StopCategory) => {
    if (inputMode === 'actions' && !chosenCategory && !category) {
      setError('Hãy chọn loại địa điểm bạn muốn tìm.');
      return;
    }
    const picked = chosenCategory ?? (category || undefined);
    const text = (inputMode === 'text' ? query.trim() : '') || (picked ? t(stopCategoryLabels[picked]) : '');
    if (text.length < 2) {
      setError('Hãy nhập nhu cầu hoặc chọn một loại địa điểm.');
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await assistantApi.explorePlaces(
        {
          query: text,
          context: inputMode === 'text' ? context : [],
          mode,
          vehicle: route?.vehicle === 'car' ? 'car' : 'motorcycle',
          ...(picked ? { category: picked } : {}),
          ...(mode === 'nearby'
            ? { center, ...(radius ? { radiusMeters: Math.round(Number(radius) * 1000) } : {}) }
            : {
                ...(route?.stops.length === 2
                  ? { points: route.stops.map(({ lat, lng }) => ({ lat, lng })) }
                  : {}),
                ...(distance !== '' ? { maxExtraDistanceMeters: Math.round(Number(distance) * 1000) } : {}),
                ...(minutes !== '' ? { maxExtraDurationSeconds: Math.round(Number(minutes) * 60) } : {}),
              }),
        },
        controller.signal,
        accessToken,
      );
      if (controller.signal.aborted) return;
      setResult(data);
      setContext((previous) =>
        [...previous, text, ...(chosenCategory ? [t(stopCategoryLabels[chosenCategory])] : [])].slice(-4),
      );
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : 'Không tìm được địa điểm.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  const applyResult = (action: () => void) => {
    if (result?.status === 'results' && Date.now() - Date.parse(result.searchedAt) > 120000) {
      setResult(null);
      setError('Kết quả đã quá 2 phút. Hãy tìm lại.');
      return;
    }
    action();
  };
  return {
    t,
    aiConfigured,
    inputMode,
    setInputMode,
    query,
    setQuery,
    context,
    setContext,
    mode,
    setMode,
    center,
    setCenter,
    category,
    setCategory,
    radius,
    setRadius,
    distance,
    setDistance,
    minutes,
    setMinutes,
    result,
    setResult,
    error,
    setError,
    loading,
    examples,
    numberLocale,
    cancelSearch,
    submit,
    handleSubmit,
    applyResult,
  };
}
