import { useI18n } from '../../../shared/i18n/I18nProvider';
import { Icon } from '../../../shared/ui/Icon';
import { SuggestionPopup } from './SuggestionPopup';
import type { usePlaceCombobox } from '../hooks/usePlaceCombobox';
import type { PlaceComboboxProps } from '../types';

type Props = Pick<PlaceComboboxProps, 'value' | 'onChange' | 'action' | 'listPositionClassName'> & {
  form: Pick<
    ReturnType<typeof usePlaceCombobox>,
    | 'listId'
    | 'activeIndex'
    | 'setActiveIndex'
    | 'searchKind'
    | 'setSearchKind'
    | 'resolving'
    | 'setResolving'
    | 'selectionRef'
    | 'remotePlaces'
    | 'status'
    | 'offset'
    | 'matches'
    | 'showList'
    | 'choose'
    | 'runAction'
    | 'emptyMessage'
  >;
};
export function PlaceSuggestionsList({ value, onChange, action, listPositionClassName, form }: Props) {
  const {
    listId,
    activeIndex,
    setActiveIndex,
    searchKind,
    setSearchKind,
    resolving,
    setResolving,
    selectionRef,
    remotePlaces,
    status,
    offset,
    matches,
    showList,
    choose,
    runAction,
    emptyMessage,
  } = form;

  const { t } = useI18n();
  return (
    <>
      {showList && (
        <SuggestionPopup positionClassName={listPositionClassName}>
          <div
            className="mb-1 flex gap-1 border-b border-line/60 p-1"
            role="group"
            aria-label={t('Loại tìm kiếm')}
          >
            {(['all', 'street'] as const).map((kind) => (
              <button
                type="button"
                key={kind}
                aria-pressed={searchKind === kind}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  selectionRef.current?.abort();
                  setResolving(false);
                  setSearchKind(kind);
                  setActiveIndex(0);
                }}
                className={`rounded-lg px-3 py-1.5 text-[11px] ${searchKind === kind ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200' : 'text-content-subtle'}`}
              >
                {t(kind === 'all' ? 'Tất cả' : 'Tên đường')}
              </button>
            ))}
          </div>
          {matches.length + offset > 0 && (
            <div id={listId} role="listbox" aria-label={t('Gợi ý địa điểm')}>
              {action && (
                <button
                  id={`${listId}-0`}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 focus:outline-none dark:hover:bg-white/10 ${activeIndex === 0 ? 'bg-slate-50 dark:bg-white/10' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(0)}
                  onClick={() => runAction(action)}
                  role="option"
                  aria-selected={activeIndex === 0}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
                    <Icon name={action.icon} size={17} />
                  </span>
                  <span className="min-w-0 flex-1 break-words text-[13px] font-semibold leading-snug text-brand-700 dark:text-brand-200">
                    {t(action.label)}
                  </span>
                  <Icon name="search" size={15} className="shrink-0 text-slate-400 dark:text-slate-500" />
                </button>
              )}
              {matches.map((place, placeIndex) => {
                const index = placeIndex + offset;
                return (
                  <button
                    key={place.id}
                    id={`${listId}-${index}`}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 focus:outline-none dark:hover:bg-white/10 ${index === activeIndex ? 'bg-slate-50 dark:bg-white/10' : ''}`}
                    onMouseDown={(event) => event.preventDefault()} // giữ focus ở input khi click
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      void choose(place);
                    }}
                    disabled={resolving}
                    role="option"
                    aria-selected={index === activeIndex}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-200">
                      <Icon name="pin" size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-content">
                        {place.name}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-content-subtle">{place.address}</span>
                    </span>
                    <Icon
                      name="arrow-up-right"
                      size={15}
                      className="shrink-0 text-slate-400 dark:text-slate-500"
                    />
                  </button>
                );
              })}
            </div>
          )}
          {matches.length === 0 && (
            <p className="px-3 py-3 text-xs leading-5 text-content-subtle">{emptyMessage}</p>
          )}
          {matches.length === 0 && status === 'ready' && /^\d[\dA-Za-z/-]*\s+/.test(value.trim()) && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(value.trim().replace(/^\d[\dA-Za-z/-]*\s+/, ''));
                setSearchKind('street');
                setActiveIndex(0);
              }}
              className="px-3 pb-3 text-left text-[11px] font-semibold text-brand-700 dark:text-indigo-300"
            >
              {t('Tìm tên đường, bỏ số nhà')}
            </button>
          )}
          {status === 'error' && matches.length > 0 && (
            <p role="alert" className="px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              {emptyMessage}
            </p>
          )}
          <div
            role="status"
            className="border-t border-line/60 px-3 py-2 text-[11px] font-medium text-slate-400 dark:text-slate-500"
          >
            {resolving
              ? t('Đang lấy tọa độ địa điểm…')
              : status === 'loading'
                ? t('Đang tìm thêm…')
                : status === 'ready' || remotePlaces.some((place) => place.source === 'vietmap')
                  ? t('VietMap · ưu tiên gần khu vực tìm kiếm')
                  : t('Địa điểm gợi ý có sẵn')}
          </div>
        </SuggestionPopup>
      )}
    </>
  );
}
