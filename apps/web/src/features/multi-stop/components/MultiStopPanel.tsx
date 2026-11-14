import { useEffect, useState, type ReactNode } from 'react';
import { SheetPanel } from '../../../app/layout/SheetPanel';
import { Icon } from '../../../shared/components/Icon';
import { popularPlaces } from '../../places/data/popularPlaces';
import type { RouteObjective, RoutePlan, TransportMode } from '../../map/types';
import type { LatLng, Place } from '../../places/types';
import { PlaceCombobox } from '../../places/components/PlaceCombobox';
import { MAX_STOPS } from '../utils/algorithms';
import { OptimizationSummary } from './OptimizationSummary';
import { useI18n } from '../../../shared/i18n/I18nProvider';

type MultiStopPanelProps = {
  isActive: boolean;
  onShowPlan: (plan: RoutePlan) => void;
  onStartNavigation: (plan: RoutePlan) => void;
  isNavigating: boolean;
  getFocus?: () => LatLng;
  onReset: (planId?: string) => void;
  onClose: () => void;
  onPlanRoute: (
    start: Place,
    stops: Place[],
    mode: TransportMode,
    objective: RouteObjective,
    returnToStart: boolean,
  ) => Promise<RoutePlan | { error: string }>;
  onSave?: (plan: RoutePlan) => void;
  /** Điểm đi và các điểm cần ghé điền sẵn (App đổi `key` để áp dụng lại). */
  initialStops?: { start: Place | null; stops: Place[] };
  /** Nội dung thêm trên nút tối ưu (chế độ thuyết trình ?demo=1: chọn thuật toán Held–Karp / NN + 2-opt). */
  presentationSlot?: ReactNode;
};

type LocalizedMessage = { source: string; values?: Record<string, string | number> };

/** Hai điểm coi là trùng nhau khi tọa độ lệch dưới ~0,1 m. */
function isSamePoint(a: LatLng, b: LatLng) {
  return Math.abs(a.lat - b.lat) < 0.000001 && Math.abs(a.lng - b.lng) < 0.000001;
}

export function MultiStopPanel({
  isActive,
  onShowPlan,
  onStartNavigation,
  isNavigating,
  onClose,
  onPlanRoute,
  onSave,
  getFocus,
  onReset,
  initialStops,
  presentationSlot,
}: MultiStopPanelProps) {
  const { language, t } = useI18n();
  const [stops, setStops] = useState<Place[]>(initialStops?.stops ?? []);
  const [start, setStart] = useState<Place | null>(initialStops?.start ?? null);
  const [startText, setStartText] = useState(initialStops?.start?.name ?? '');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<TransportMode>('motorcycle');
  const [returnToStart, setReturnToStart] = useState(false);
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [error, setError] = useState<LocalizedMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [objective, setObjective] = useState<RouteObjective>('time');
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
    if (!start) {
      setError({ source: 'Hãy chọn điểm xuất phát từ gợi ý.' });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await onPlanRoute(start, stops, mode, objective, returnToStart);
      if ('error' in result) {
        setError({ source: result.error });
        setPlan(null);
      } else {
        setPlan(result);
        setStops(result.stops.slice(1, returnToStart ? -1 : undefined));
      }
    } catch {
      setError({ source: 'Không tính được hành trình. Hãy thử lại.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SheetPanel
      eyebrow={t('LẬP KẾ HOẠCH')}
      title={t('Hành trình nhiều điểm')}
      icon="multi-stop"
      onClose={onClose}
      hidden={!isActive}
    >
      <p className="mb-4 text-[12px] leading-5 text-slate-500 dark:text-slate-400">
        {t(
          'Chọn các điểm cần ghé. Tự sắp xếp thứ tự tốt nhất theo thời gian hoặc quãng đường, giữ cố định điểm xuất phát.',
        )}
      </p>
      <fieldset disabled={isLoading}>
        {(start || stops.length > 0 || query || startText) && (
          <button
            type="button"
            onClick={reset}
            className="mb-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 underline"
          >
            {t('Xóa hành trình')}
          </button>
        )}
        <div className="mb-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-800/60 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[.09em] text-slate-500 dark:text-slate-400">
            {t('Điểm xuất phát')}
          </p>
          <PlaceCombobox
            ariaLabel={t('Điểm xuất phát hành trình nhiều điểm')}
            className="w-full"
            icon="current-location"
            inputClassName="h-10 bg-white dark:bg-slate-800"
            getFocus={getFocus}
            onChange={(value) => {
              setStartText(value);
              setStart(null);
              setPlan(null);
            }}
            onSelect={selectStart}
            places={popularPlaces}
            placeholder={t('Chọn điểm xuất phát')}
            value={startText}
          />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <label className="min-w-0">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.08em] text-slate-500 dark:text-slate-400">
              {t('Phương tiện')}
            </span>
            <select
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as TransportMode);
                setPlan(null);
              }}
              className="h-10 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/60 px-2.5 text-xs font-semibold text-ink dark:text-slate-100 outline-none focus:border-brand-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-brand-100 dark:focus:ring-indigo-400/25"
            >
              <option value="motorcycle">{t('Xe máy')}</option>
              <option value="car">{t('Ô tô')}</option>
            </select>
          </label>
          <label className="min-w-0">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.08em] text-slate-500 dark:text-slate-400">
              {t('Ưu tiên')}
            </span>
            <select
              value={objective}
              onChange={(event) => {
                setObjective(event.target.value as RouteObjective);
                setPlan(null);
              }}
              className="h-10 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/60 px-2.5 text-xs font-semibold text-ink dark:text-slate-100 outline-none focus:border-brand-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-brand-100 dark:focus:ring-indigo-400/25"
            >
              <option value="time">{t('Thời gian')}</option>
              <option value="distance">{t('Quãng đường')}</option>
            </select>
          </label>
        </div>

        <label className="mb-4 flex cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={returnToStart}
            onChange={(event) => {
              setReturnToStart(event.target.checked);
              setPlan(null);
            }}
            className="h-3.5 w-3.5 accent-brand-600 dark:accent-indigo-400"
          />
          {t('Quay lại điểm xuất phát')}
        </label>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[12px] font-bold text-ink dark:text-slate-100">{t('Điểm cần ghé')}</p>
          <span className="rounded-full bg-slate-100 dark:bg-slate-700/50 px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {stops.length}/{MAX_STOPS}
          </span>
        </div>
        <ol className="mb-3 space-y-1.5" aria-label={t('Danh sách điểm dừng')}>
          {stops.map((place, index) => (
            <li
              key={place.id}
              className="flex items-center gap-2.5 rounded-xl border border-slate-100 dark:border-white/10 bg-white dark:bg-slate-800/60 px-3 py-2.5"
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${index === 0 ? 'bg-brand-50 dark:bg-indigo-400/10 text-brand-700 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300'}`}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold text-ink dark:text-slate-100">
                  {place.name}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                  {place.address}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setStops((current) => current.filter((stop) => stop.id !== place.id));
                  setPlan(null);
                }}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 dark:text-slate-500 transition hover:bg-red-50 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-300"
                aria-label={t('Xóa {name}', { name: place.name })}
              >
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ol>
        <div className="mb-4">
          <PlaceCombobox
            getFocus={getFocus}
            ariaLabel={t('Tìm điểm dừng để thêm')}
            className="w-full"
            icon="plus"
            inputClassName="h-[44px] bg-white dark:bg-slate-800"
            onChange={setQuery}
            onSelect={addStop}
            places={popularPlaces.filter((place) => !stops.some((stop) => stop.id === place.id))}
            placeholder={t('Thêm điểm dừng')}
            value={query}
          />
        </div>
        {presentationSlot}
        <div className="sticky bottom-0 z-20 -mx-5 bg-gradient-to-t from-white dark:from-slate-900 via-white/95 dark:via-slate-900/95 to-transparent px-5 pb-1 pt-3">
          <button
            type="button"
            onClick={() => void optimize()}
            disabled={isLoading || !start || stops.length < 1}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-xs font-bold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 dark:disabled:text-slate-400 disabled:shadow-none"
          >
            {isLoading ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                aria-hidden="true"
              />
            ) : (
              <Icon name="route" size={17} />
            )}
            {isLoading ? t('Đang tối ưu đường đi…') : t('Tối ưu hành trình')}
          </button>
        </div>
      </fieldset>
      {error && (
        <p
          className="mt-3 rounded-xl border border-amber-200 dark:border-amber-300/20 bg-amber-50 dark:bg-amber-400/10 px-3 py-2.5 text-[11px] leading-5 text-amber-900 dark:text-amber-100"
          role="alert"
        >
          {t(error.source, error.values)}
        </p>
      )}
      {plan && (
        <div
          className="mt-3 rounded-xl border border-brand-100 dark:border-indigo-300/20 bg-brand-50/70 dark:bg-indigo-400/10 px-3 py-3"
          role="status"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-brand-800 dark:text-indigo-300">
                {t('Đã sắp xếp hành trình')}
              </p>
              <p className="mt-1 text-[11px] text-brand-800/80 dark:text-indigo-300/80">
                {plan.distanceKm.toLocaleString(language === 'en' ? 'en-US' : 'vi-VN', {
                  maximumFractionDigits: 1,
                })}{' '}
                km · {t('{minutes} phút', { minutes: Math.round(plan.durationMin) })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSave?.(plan)}
              className="rounded-lg border border-brand-200 dark:border-indigo-300/25 bg-white dark:bg-slate-800/60 px-2.5 py-2 text-[11px] font-semibold text-brand-700 dark:text-indigo-300"
            >
              {t('Lưu')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => onStartNavigation(plan)}
            disabled={isNavigating}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-[11px] font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:bg-emerald-600"
          >
            <Icon name={isNavigating ? 'check' : 'directions'} size={15} />
            {isNavigating ? t('Đang dẫn đường') : t('Bắt đầu chuyến đi')}
          </button>
          {plan.optimization && <OptimizationSummary optimization={plan.optimization} />}
          <ol className="mt-3 space-y-1.5">
            {plan.stops.map((place, index) => (
              <li
                key={`${place.id}-${index}`}
                className="flex items-center gap-2 text-[11px] font-medium text-slate-700 dark:text-slate-200"
              >
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white dark:bg-slate-800/60 text-[11px] font-bold text-brand-700 dark:text-indigo-300">
                  {index === 0
                    ? 'A'
                    : index === plan.stops.length - 1 && place.id === start?.id
                      ? '↩'
                      : index}
                </span>
                {place.name}
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="mt-4 border-t border-slate-100 dark:border-white/10 pt-3 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
        {t(
          'Tối ưu theo chi phí đường bộ VietMap, có xét chiều di chuyển. Để đi theo thứ tự tự chọn, dùng mục Chỉ đường.',
        )}
      </div>
    </SheetPanel>
  );
}
