import { useI18n } from '../../../shared/i18n/I18nProvider';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { Select } from '../../../shared/ui/Input';
import { PlaceCombobox } from '../../places/components/PlaceCombobox';
import { popularPlaces } from '../../places/domain/popularPlaces';
import type { RouteObjective, TransportMode } from '../../routing/types';
import { MAX_STOPS } from '../domain/limits';
import type { useMultiStopForm } from '../hooks/useMultiStopForm';
import type { MultiStopPanelProps } from '../types';

type Props = Pick<MultiStopPanelProps, 'getFocus' | 'presentationSlot'> & {
  form: Pick<
    ReturnType<typeof useMultiStopForm>,
    | 'stops'
    | 'setStops'
    | 'start'
    | 'setStart'
    | 'startText'
    | 'setStartText'
    | 'query'
    | 'setQuery'
    | 'mode'
    | 'setMode'
    | 'returnToStart'
    | 'setReturnToStart'
    | 'setPlan'
    | 'isLoading'
    | 'objective'
    | 'setObjective'
    | 'addStop'
    | 'selectStart'
    | 'reset'
    | 'optimize'
  >;
};
export function MultiStopEditor({ getFocus, presentationSlot, form }: Props) {
  const {
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
    setPlan,
    isLoading,
    objective,
    setObjective,
    addStop,
    selectStart,
    reset,
    optimize,
  } = form;

  const { t } = useI18n();
  return (
    <fieldset disabled={isLoading}>
      {(start || stops.length > 0 || query || startText) && (
        <button
          type="button"
          onClick={reset}
          className="mb-3 text-[11px] font-semibold text-content-subtle underline"
        >
          {t('Xóa hành trình')}
        </button>
      )}
      <div className="mb-4 rounded-xl border border-line bg-slate-50/70 dark:bg-slate-800/60 p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[.09em] text-content-subtle">
          {t('Điểm xuất phát')}
        </p>
        <PlaceCombobox
          ariaLabel={t('Điểm xuất phát hành trình nhiều điểm')}
          className="w-full"
          icon="current-location"
          inputClassName="h-10 bg-surface"
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
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.08em] text-content-subtle">
            {t('Phương tiện')}
          </span>
          <Select
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as TransportMode);
              setPlan(null);
            }}
            className="h-10 w-full rounded-xl border border-line bg-surface px-2.5 text-xs font-semibold text-content outline-none focus:border-brand-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-brand-100 dark:focus:ring-indigo-400/25"
          >
            <option value="motorcycle">{t('Xe máy')}</option>
            <option value="car">{t('Ô tô')}</option>
          </Select>
        </label>
        <label className="min-w-0">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.08em] text-content-subtle">
            {t('Ưu tiên')}
          </span>
          <Select
            value={objective}
            onChange={(event) => {
              setObjective(event.target.value as RouteObjective);
              setPlan(null);
            }}
            className="h-10 w-full rounded-xl border border-line bg-surface px-2.5 text-xs font-semibold text-content outline-none focus:border-brand-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-brand-100 dark:focus:ring-indigo-400/25"
          >
            <option value="time">{t('Thời gian')}</option>
            <option value="distance">{t('Quãng đường')}</option>
          </Select>
        </label>
      </div>

      <label className="mb-4 flex cursor-pointer items-center gap-2 text-[11px] font-medium text-content-muted">
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
        <p className="text-[12px] font-bold text-content">{t('Điểm cần ghé')}</p>
        <span className="rounded-full bg-surface-raised px-2 py-1 text-[11px] font-semibold text-content-subtle">
          {stops.length}/{MAX_STOPS}
        </span>
      </div>
      <ol className="mb-3 space-y-1.5" aria-label={t('Danh sách điểm dừng')}>
        {stops.map((place, index) => (
          <li
            key={place.id}
            className="flex items-center gap-2.5 rounded-xl border border-line/60 bg-surface px-3 py-2.5"
          >
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${index === 0 ? 'bg-brand-50 dark:bg-indigo-400/10 text-brand-700 dark:text-indigo-300' : 'bg-surface-raised text-content-muted'}`}
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-content">{place.name}</span>
              <span className="mt-0.5 block text-[11px] text-content-subtle">{place.address}</span>
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
          inputClassName="h-[44px] bg-surface"
          onChange={setQuery}
          onSelect={addStop}
          places={popularPlaces.filter((place) => !stops.some((stop) => stop.id === place.id))}
          placeholder={t('Thêm điểm dừng')}
          value={query}
        />
      </div>
      {presentationSlot}
      <div className="sticky bottom-0 z-20 -mx-5 bg-gradient-to-t from-white dark:from-slate-900 via-white/95 dark:via-slate-900/95 to-transparent px-5 pb-1 pt-3">
        <Button
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
        </Button>
      </div>
    </fieldset>
  );
}
