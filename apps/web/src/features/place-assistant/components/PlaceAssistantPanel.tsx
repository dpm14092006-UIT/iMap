import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  stopCategories,
  stopCategoryLabels,
  type ExplorePlacesResponse,
  type RouteStopCandidate,
  type StopCategory,
  type StopPlace,
} from '@routetwin/shared';
import { SheetPanel } from '../../../app/layout/SheetPanel';
import type { RoutePlan } from '../../map/types';
import { assistantApi } from '../services/assistantApi';
import { useApiSpeechDraft } from '../hooks/useApiSpeechDraft';
import { useSpeechDraft } from '../hooks/useSpeechDraft';
type Point = { lat: number; lng: number };
type Props = {
  accessToken: string;
  route: RoutePlan | null;
  selectedPoint: Point | null;
  getMapCenter: () => Point;
  onClose: () => void;
  onFocus: (place: StopPlace) => void;
  onDirections: (place: StopPlace) => void;
  onAddStop: (candidate: RouteStopCandidate, routeId: string) => void;
  onRemoveStop: () => void;
};
const examples = [
  "I'm running low on fuel",
  'Find a school nearby',
  'Find the station',
  'Tôi cần nghỉ một chút',
];
export function PlaceAssistantPanel({
  accessToken,
  route,
  selectedPoint,
  getMapCenter,
  onClose,
  onFocus,
  onDirections,
  onAddStop,
  onRemoveStop,
}: Props) {
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [inputMode, setInputMode] = useState<'actions' | 'voice'>('actions');
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
  const [language, setLanguage] = useState('vi-VN');
  const requestRef = useRef<AbortController | null>(null);
  const speech = useSpeechDraft(setQuery);
  const apiSpeech = useApiSpeechDraft(setQuery, accessToken);
  const [voiceEngine, setVoiceEngine] = useState<'browser' | 'api'>('browser');
  const voiceBusy = speech.listening || apiSpeech.listening || apiSpeech.processing;
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
  }, [routeId, mode, center.lat, center.lng]);
  useEffect(() => {
    if (selectedPoint) setCenter(selectedPoint);
  }, [selectedPoint]);
  useEffect(() => () => requestRef.current?.abort(), []);
  const submit = async (chosenCategory?: StopCategory) => {
    if (inputMode === 'actions' && !chosenCategory && !category) {
      setError('Hãy chọn loại địa điểm bạn muốn tìm.');
      return;
    }
    const text =
      (inputMode === 'voice' ? query.trim() : '') ||
      (chosenCategory || category ? stopCategoryLabels[(chosenCategory ?? category) as StopCategory] : '');
    if (text.length < 2) {
      setError('Hãy nhập nhu cầu hoặc chọn một loại địa điểm.');
      return;
    }
    requestRef.current?.abort();
    speech.stop();
    apiSpeech.cancel();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await assistantApi.explorePlaces(
        {
          query: text,
          context: inputMode === 'voice' ? context : [],
          mode,
          vehicle: route?.vehicle === 'car' ? 'car' : 'motorcycle',
          ...(chosenCategory || category ? { category: (chosenCategory ?? category) as StopCategory } : {}),
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
        [...previous, text, ...(chosenCategory ? [stopCategoryLabels[chosenCategory]] : [])].slice(-4),
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
  return (
    <SheetPanel eyebrow="TÌM THEO NHU CẦU" title="Trợ lý địa điểm" icon="sparkles" onClose={onClose}>
      <div
        role="group"
        aria-label="Cách dùng trợ lý"
        className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-700/50 p-1"
      >
        {(['actions', 'voice'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={inputMode === value}
            onClick={() => {
              requestRef.current?.abort();
              speech.stop();
              apiSpeech.cancel();
              setLoading(false);
              setInputMode(value);
              setCategory('');
              setResult(null);
              setError('');
            }}
            className={`rounded-lg p-3 text-[12px] font-semibold ${inputMode === value ? 'bg-white dark:bg-slate-800/60 text-brand-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}
          >
            {value === 'actions' ? 'Chọn thao tác' : 'Giọng nói'}
          </button>
        ))}
      </div>
      <p className="mb-3 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
        {inputMode === 'actions'
          ? 'Chọn loại địa điểm và phạm vi, rồi bấm Tìm. Kết quả lấy từ dữ liệu OpenStreetMap.'
          : 'Nói nhu cầu, kiểm tra hoặc sửa câu nhận dạng rồi bấm Tìm. Trợ lý sẽ hỏi lại nếu yêu cầu chưa rõ.'}
      </p>
      <div
        role="group"
        aria-label="Phạm vi tìm kiếm"
        className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-700/50 p-1"
      >
        {(['nearby', 'route'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            className={`rounded-lg p-2 text-[11px] font-semibold ${mode === value ? 'bg-white dark:bg-slate-800/60 text-brand-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}
          >
            {value === 'nearby' ? 'Quanh vị trí chọn' : 'Dọc tuyến đang đi'}
          </button>
        ))}
      </div>
      {mode === 'nearby' ? (
        <div className="mb-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2 text-[11px] text-slate-600 dark:text-slate-300">
          <p>
            Tìm quanh: {center.lat.toFixed(4)}, {center.lng.toFixed(4)}. Bấm bản đồ để đổi vị trí.
          </p>
          <button
            type="button"
            onClick={() => setCenter(getMapCenter())}
            className="mt-1 font-semibold text-brand-700 dark:text-indigo-300 underline"
          >
            Dùng tâm bản đồ hiện tại
          </button>
        </div>
      ) : !route || route.stops.length !== 2 ? (
        <div className="mb-3 rounded-xl bg-amber-50 dark:bg-amber-400/10 p-2 text-[11px] text-amber-900 dark:text-amber-100">
          Cần một tuyến hai điểm để tính đường đi thêm. Bạn vẫn có thể hỏi hoặc chuyển sang tìm quanh vị trí.
          {route && route.stops.length > 2 && (
            <button type="button" onClick={onRemoveStop} className="mt-2 block font-semibold underline">
              Bỏ điểm dừng để tìm lại
            </button>
          )}
        </div>
      ) : (
        <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-400">
          {route.stops[0]?.name} → {route.stops[1]?.name}. So sánh với tuyến không ghé.
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        {inputMode === 'voice' ? (
          <>
            <p
              role="status"
              className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2 text-[11px] leading-5 text-slate-600 dark:text-slate-300"
            >
              {aiConfigured === true
                ? 'Đã cấu hình AI hiểu nhu cầu. Nếu dịch vụ lỗi, trợ lý sẽ thông báo khi dùng từ khóa.'
                : aiConfigured === false
                  ? 'AI chưa bật. Bạn vẫn có thể nói hoặc nhập nhu cầu đơn giản; trợ lý đang hiểu bằng từ khóa.'
                  : 'Chưa xác nhận được trạng thái AI. Nguồn xử lý sẽ hiển thị cùng kết quả.'}
            </p>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200">
              Nhu cầu / câu đã nhận dạng
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={loading || voiceBusy}
                maxLength={300}
                rows={3}
                placeholder="Ví dụ: Tìm trạm xăng trong bán kính 2 km"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white text-ink placeholder:text-slate-400 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 p-3 text-[12px] font-normal focus:border-brand-500 dark:focus:border-indigo-400 focus:outline-none disabled:bg-slate-50 dark:disabled:bg-slate-800/40"
              />
            </label>
            <div className="flex flex-wrap gap-1">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  disabled={loading || voiceBusy}
                  onClick={() => {
                    setQuery(example);
                    setCategory('');
                  }}
                  className="rounded-full bg-slate-100 dark:bg-slate-700/50 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>
            <label className="block text-[11px] text-slate-600 dark:text-slate-300">
              Dịch vụ voice
              <select
                aria-label="Dịch vụ voice"
                value={voiceEngine}
                disabled={voiceBusy}
                onChange={(event) => {
                  setVoiceEngine(event.target.value as 'browser' | 'api');
                  setLanguage('vi-VN');
                }}
                className="ml-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-ink dark:text-slate-100 p-2"
              >
                <option value="browser">Trình duyệt</option>
                <option value="api" disabled={!apiSpeech.available}>
                  Whisper API{apiSpeech.available ? '' : ' (chưa cấu hình)'}
                </option>
              </select>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={
                  loading ||
                  apiSpeech.processing ||
                  (voiceEngine === 'api' ? !apiSpeech.available : !speech.supported)
                }
                onClick={() =>
                  voiceEngine === 'api'
                    ? apiSpeech.listening
                      ? apiSpeech.stop()
                      : void apiSpeech.start()
                    : speech.listening
                      ? speech.stop()
                      : speech.start(language)
                }
                className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-[11px] font-semibold text-brand-700 dark:text-indigo-300 disabled:opacity-40"
              >
                {apiSpeech.processing
                  ? 'Đang nhận dạng…'
                  : apiSpeech.listening
                    ? 'Xong, nhận dạng'
                    : speech.listening
                      ? 'Dừng nghe'
                      : 'Nhập bằng giọng nói'}
              </button>
              <select
                aria-label="Ngôn ngữ giọng nói"
                disabled={voiceBusy || voiceEngine === 'api'}
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="min-w-0 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-ink dark:text-slate-100 p-2 text-[11px]"
              >
                <option value="en-US">English</option>
                <option value="vi-VN">Tiếng Việt</option>
              </select>
            </div>
            <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
              {voiceEngine === 'api'
                ? 'Ghi tối đa 15 giây; âm thanh gửi qua máy chủ đến Cloudflare Whisper. Bấm Xong để nhận dạng, kiểm tra chữ rồi bấm Tìm.'
                : speech.supported
                  ? 'Chỉ nghe khi bạn bấm nút. Trình duyệt có thể gửi âm thanh đến dịch vụ nhận giọng nói. Kiểm tra chữ rồi bấm Tìm; không tự gửi.'
                  : 'Trình duyệt này chưa hỗ trợ voice. Bạn vẫn có thể nhập chữ tiếng Anh hoặc Việt.'}
            </p>
            {(speech.listening || apiSpeech.listening) && (
              <p role="status" className="text-[11px] text-brand-700 dark:text-indigo-300">
                Đang nghe…
              </p>
            )}
            {(apiSpeech.listening || apiSpeech.processing) && (
              <button type="button" onClick={apiSpeech.cancel} className="text-[11px] underline">
                Hủy ghi âm / nhận dạng
              </button>
            )}
            {apiSpeech.error && voiceEngine === 'api' && (
              <p role="alert" className="text-[11px] text-amber-800 dark:text-amber-200">
                {apiSpeech.error}
              </p>
            )}
            {speech.error && (
              <p role="alert" className="text-[11px] text-amber-800 dark:text-amber-200">
                {speech.error}
              </p>
            )}
          </>
        ) : (
          <fieldset disabled={loading}>
            <legend className="mb-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
              Bạn muốn tìm gì?
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {stopCategories.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={category === value}
                  onClick={() => {
                    setCategory(value);
                    setResult(null);
                    setError('');
                  }}
                  className={`rounded-xl border p-2 text-left text-[11px] font-semibold ${category === value ? 'border-brand-500 bg-brand-50 dark:bg-indigo-400/10 text-brand-700 dark:text-indigo-300' : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'}`}
                >
                  {stopCategoryLabels[value]}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <details
          open={inputMode === 'actions' ? true : undefined}
          className="rounded-xl border border-slate-200 dark:border-white/10 p-2"
        >
          <summary className="cursor-pointer text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            {inputMode === 'actions' ? 'Phạm vi và giới hạn' : 'Bộ lọc tùy chọn'}
          </summary>
          <div className="mt-2 space-y-2">
            {inputMode === 'voice' && (
              <label className="block text-[11px]">
                Loại địa điểm
                <select
                  value={category}
                  disabled={loading}
                  onChange={(event) => setCategory(event.target.value as StopCategory | '')}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-ink dark:text-slate-100 p-2"
                >
                  <option value="">Hiểu từ yêu cầu</option>
                  {stopCategories.map((value) => (
                    <option key={value} value={value}>
                      {stopCategoryLabels[value]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {mode === 'nearby' ? (
              <label className="block text-[11px]">
                Bán kính (km)
                <input
                  value={radius}
                  onChange={(event) => setRadius(event.target.value)}
                  disabled={loading}
                  type="number"
                  min="0.1"
                  max="5"
                  step="0.1"
                  placeholder="Mặc định 2 km"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white text-ink placeholder:text-slate-400 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 p-2"
                />
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px]">
                  Đi thêm tối đa (km)
                  <input
                    value={distance}
                    onChange={(event) => setDistance(event.target.value)}
                    disabled={loading}
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    placeholder="Mặc định 2 km"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white text-ink placeholder:text-slate-400 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 p-2"
                  />
                </label>
                <label className="text-[11px]">
                  Thêm tối đa (phút)
                  <input
                    value={minutes}
                    onChange={(event) => setMinutes(event.target.value)}
                    disabled={loading}
                    type="number"
                    min="0"
                    max="60"
                    placeholder="Mặc định 15 phút"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white text-ink placeholder:text-slate-400 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 p-2"
                  />
                </label>
              </div>
            )}
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Bộ lọc chọn tay được ưu tiên hơn câu nhập.
            </p>
          </div>
        </details>
        <button
          type="submit"
          disabled={loading || voiceBusy || (inputMode === 'actions' && !category)}
          className="w-full rounded-xl bg-brand-600 p-3 text-[12px] font-bold text-white hover:bg-brand-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
        >
          {loading ? 'Đang tìm địa điểm…' : 'Tìm địa điểm'}
        </button>
        {loading && (
          <button
            type="button"
            onClick={() => {
              requestRef.current?.abort();
              setLoading(false);
            }}
            className="w-full text-[11px] text-slate-500 dark:text-slate-400"
          >
            Hủy tìm kiếm
          </button>
        )}
      </form>
      {inputMode === 'voice' && context.length > 0 && (
        <button
          type="button"
          onClick={() => {
            requestRef.current?.abort();
            setLoading(false);
            setContext([]);
            setResult(null);
            setCategory('');
          }}
          className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 underline"
        >
          Xóa ngữ cảnh trao đổi
        </button>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-400/10 p-3 text-[11px] text-amber-900 dark:text-amber-100"
        >
          {error}
        </p>
      )}
      {result && (
        <div aria-live="polite" className="mt-4 space-y-3">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {result.source === 'ai' ? 'AI hiểu yêu cầu' : 'Đang dùng bộ lọc ngôn ngữ; chưa có kết quả từ AI'}
          </p>
          {result.status === 'clarify' ? (
            <div className="rounded-xl border border-brand-100 dark:border-indigo-300/20 bg-brand-50 dark:bg-indigo-400/10 p-3">
              <p className="text-[12px] font-semibold text-ink dark:text-slate-100">{result.question}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.suggestions.map((value) => (
                  <button
                    type="button"
                    key={value}
                    disabled={loading}
                    onClick={() => {
                      void submit(value);
                    }}
                    className="rounded-full border border-brand-200 dark:border-indigo-300/25 bg-white dark:bg-slate-800/60 px-3 py-2 text-[11px] font-semibold text-brand-700 dark:text-indigo-300"
                  >
                    {stopCategoryLabels[value]}
                  </button>
                ))}
              </div>
            </div>
          ) : result.status === 'needs_location' || result.status === 'needs_route' ? (
            <p className="rounded-xl bg-amber-50 dark:bg-amber-400/10 p-3 text-[11px] text-amber-900 dark:text-amber-100">
              {result.message}
            </p>
          ) : result.mode === 'nearby' ? (
            <>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {stopCategoryLabels[result.category]} · bán kính {result.radiusMeters / 1000} km · khoảng cách
                đường thẳng.
              </p>
              {!result.places.length && (
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Chưa có kết quả trong phạm vi dữ liệu khảo sát. Thử đổi vị trí hoặc bán kính.
                </p>
              )}
              {result.places.map(({ place, distanceMeters }) => (
                <article
                  key={place.id}
                  className="rounded-xl border border-slate-200 dark:border-white/10 p-3"
                >
                  <h3 className="text-[12px] font-bold text-ink dark:text-slate-100">{place.name}</h3>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{place.address}</p>
                  <p className="mt-2 text-[11px] text-slate-700 dark:text-slate-200">
                    Cách vị trí chọn khoảng{' '}
                    {(distanceMeters / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} km đường
                    thẳng.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onFocus(place)}
                      className="rounded-lg border border-slate-200 dark:border-white/10 px-2 py-2 text-[11px] font-semibold"
                    >
                      Xem trên bản đồ
                    </button>
                    <button
                      type="button"
                      onClick={() => applyResult(() => onDirections(place))}
                      className="rounded-lg bg-brand-600 px-2 py-2 text-[11px] font-semibold text-white"
                    >
                      Chỉ đường đến đây
                    </button>
                    <a
                      href={place.osmUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="self-center text-[11px] text-brand-700 dark:text-indigo-300 underline"
                    >
                      Nguồn OSM
                    </a>
                  </div>
                </article>
              ))}
            </>
          ) : (
            <>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {stopCategoryLabels[result.category]} · tối đa{' '}
                {result.routeStops.interpretation.maxExtraDistanceMeters / 1000} km và{' '}
                {result.routeStops.interpretation.maxExtraDurationSeconds / 60} phút đi thêm.
              </p>
              {!result.routeStops.candidates.length && (
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Chưa tìm thấy điểm đáp ứng giới hạn trong phạm vi khảo sát.
                </p>
              )}
              {result.routeStops.candidates.map((candidate) => (
                <article
                  key={candidate.place.id}
                  className="rounded-xl border border-brand-100 dark:border-indigo-300/20 bg-brand-50/40 dark:bg-indigo-400/10 p-3"
                >
                  <h3 className="text-[12px] font-bold text-ink dark:text-slate-100">
                    {candidate.place.name}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {candidate.place.address}
                  </p>
                  <p className="mt-2 text-[11px] leading-5 text-slate-700 dark:text-slate-200">
                    {candidate.reason}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <a
                      href={candidate.place.osmUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-brand-700 dark:text-indigo-300 underline"
                    >
                      Nguồn OSM
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        applyResult(() => {
                          if (route) onAddStop(candidate, route.id);
                        })
                      }
                      className="rounded-lg bg-brand-600 px-3 py-2 text-[11px] font-semibold text-white"
                    >
                      Ghé điểm này
                    </button>
                  </div>
                </article>
              ))}
            </>
          )}
          {'warnings' in result && result.warnings.length > 0 && (
            <details open className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
              <summary className="cursor-pointer">Nguồn dữ liệu và giới hạn</summary>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {result.warnings.map((warning, index) => (
                  <li key={`${index}-${warning}`}>{warning}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </SheetPanel>
  );
}
