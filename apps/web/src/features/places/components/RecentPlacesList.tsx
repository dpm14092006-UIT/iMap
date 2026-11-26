import { useI18n } from '../../../shared/i18n/I18nProvider';
import { Icon } from '../../../shared/ui/Icon';
import { SuggestionPopup } from './SuggestionPopup';
import type { usePlaceCombobox } from '../hooks/usePlaceCombobox';
import type { PlaceComboboxProps } from '../types';

type Props = Pick<
  PlaceComboboxProps,
  'onChange' | 'onSelect' | 'recentPlaces' | 'onRemoveRecent' | 'listPositionClassName'
> & {
  form: Pick<ReturnType<typeof usePlaceCombobox>, 'setOpen' | 'showRecent'>;
};
export function RecentPlacesList({
  onChange,
  onSelect,
  recentPlaces = [],
  onRemoveRecent,
  listPositionClassName,
  form,
}: Props) {
  const { setOpen, showRecent } = form;

  const { t } = useI18n();
  return (
    <>
      {showRecent && (
        <SuggestionPopup
          positionClassName={listPositionClassName}

          role="group"
          aria-label={t('Điểm gần đây')}
        >
          <p className="flex items-center gap-1.5 px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            <Icon name="clock" size={13} /> {t('Gần đây')}
          </p>
          {recentPlaces.map((place) => (
            <div
              key={place.id}
              className="group flex items-center rounded-xl transition hover:bg-slate-50 dark:hover:bg-white/10"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(place.name);
                  onSelect(place);
                  setOpen(false);
                }}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300">
                  <Icon name="clock" size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-content">{place.name}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-content-subtle">
                    {place.address}
                  </span>
                </span>
              </button>
              {onRemoveRecent && (
                <button
                  type="button"
                  className="mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 dark:hover:bg-white/10 dark:hover:text-red-300"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onRemoveRecent(place)}
                  aria-label={t('Xóa {name} khỏi lịch sử', { name: place.name })}
                  title={t('Xóa khỏi lịch sử')}
                >
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
          ))}
        </SuggestionPopup>
      )}
    </>
  );
}
