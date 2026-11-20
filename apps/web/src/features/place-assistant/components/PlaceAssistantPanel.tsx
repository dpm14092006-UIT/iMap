import { SheetPanel } from '../../../shared/ui/SheetPanel';
import { usePlaceAssistant } from '../hooks/usePlaceAssistant';
import type { PlaceAssistantPanelProps } from '../types';
import { AssistantResults } from './AssistantResults';
import { AssistantSearchForm } from './AssistantSearchForm';
export function PlaceAssistantPanel(props: PlaceAssistantPanelProps) {
  const { route, getMapCenter, onClose, onFocus, onDirections, onAddStop, onRemoveStop } = props;
  const form = usePlaceAssistant(props);
  const {
    t,
    inputMode,
    setInputMode,
    context,
    setContext,
    mode,
    setMode,
    center,
    setCenter,
    setCategory,
    setResult,
    error,
    setError,
    cancelSearch,
  } = form;
  return (
    <SheetPanel
      eyebrow={t('TÌM THEO NHU CẦU')}
      title={t('Trợ lý địa điểm')}
      icon="sparkles"
      onClose={onClose}
    >
      <div
        role="group"
        aria-label={t('Cách dùng trợ lý')}
        className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-surface-raised p-1"
      >
        {(['actions', 'text'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={inputMode === value}
            onClick={() => {
              cancelSearch();
              setInputMode(value);
              setCategory('');
              setResult(null);
              setError('');
            }}
            className={`rounded-lg p-3 text-[12px] font-semibold ${inputMode === value ? 'bg-surface text-brand-700 dark:text-indigo-300 shadow-sm' : 'text-content-muted'}`}
          >
            {value === 'actions' ? t('Chọn thao tác') : t('Nhập nhu cầu')}
          </button>
        ))}
      </div>
      <p className="mb-3 text-[11px] leading-5 text-content-subtle">
        {inputMode === 'actions'
          ? t('Chọn loại địa điểm và phạm vi, rồi bấm Tìm. Kết quả lấy từ dữ liệu OpenStreetMap.')
          : t('Nhập nhu cầu rồi bấm Tìm. Trợ lý sẽ hỏi lại nếu yêu cầu chưa rõ.')}
      </p>
      <div
        role="group"
        aria-label={t('Phạm vi tìm kiếm')}
        className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-surface-raised p-1"
      >
        {(['nearby', 'route'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            className={`rounded-lg p-2 text-[11px] font-semibold ${mode === value ? 'bg-surface text-brand-700 dark:text-indigo-300 shadow-sm' : 'text-content-muted'}`}
          >
            {value === 'nearby' ? t('Quanh vị trí chọn') : t('Dọc tuyến đang đi')}
          </button>
        ))}
      </div>
      {mode === 'nearby' ? (
        <div className="mb-3 rounded-xl bg-surface-muted p-2 text-[11px] text-content-muted">
          <p>
            {t('Tìm quanh: {lat}, {lng}. Bấm bản đồ để đổi vị trí.', {
              lat: center.lat.toFixed(4),
              lng: center.lng.toFixed(4),
            })}
          </p>
          <button
            type="button"
            onClick={() => setCenter(getMapCenter())}
            className="mt-1 font-semibold text-brand-700 dark:text-indigo-300 underline"
          >
            {t('Dùng tâm bản đồ hiện tại')}
          </button>
        </div>
      ) : !route || route.stops.length !== 2 ? (
        <div className="mb-3 rounded-xl bg-amber-50 dark:bg-amber-400/10 p-2 text-[11px] text-amber-900 dark:text-amber-100">
          {t(
            'Cần một tuyến hai điểm để tính đường đi thêm. Bạn vẫn có thể hỏi hoặc chuyển sang tìm quanh vị trí.',
          )}
          {route && route.stops.length > 2 && (
            <button type="button" onClick={onRemoveStop} className="mt-2 block font-semibold underline">
              {t('Bỏ điểm dừng để tìm lại')}
            </button>
          )}
        </div>
      ) : (
        <p className="mb-3 text-[11px] text-content-subtle">
          {t('{origin} → {destination}. So sánh với tuyến không ghé.', {
            origin: route.stops[0]?.name ?? '',
            destination: route.stops[1]?.name ?? '',
          })}
        </p>
      )}
      <AssistantSearchForm form={form} />
      {inputMode === 'text' && context.length > 0 && (
        <button
          type="button"
          onClick={() => {
            cancelSearch();
            setContext([]);
            setResult(null);
            setCategory('');
          }}
          className="mt-2 text-[11px] text-content-subtle underline"
        >
          {t('Xóa ngữ cảnh trao đổi')}
        </button>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-400/10 p-3 text-[11px] text-amber-900 dark:text-amber-100"
        >
          {t(error)}
        </p>
      )}
      <AssistantResults
        route={route}
        onFocus={onFocus}
        onDirections={onDirections}
        onAddStop={onAddStop}
        form={form}
      />
    </SheetPanel>
  );
}
