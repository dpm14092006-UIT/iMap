import { Icon } from '../../../shared/ui/Icon';
import { Input } from '../../../shared/ui/Input';
import { usePlaceCombobox } from '../hooks/usePlaceCombobox';
import type { PlaceComboboxProps } from '../types';
import { PlaceSuggestionsList } from './PlaceSuggestionsList';
import { RecentPlacesList } from './RecentPlacesList';

export function PlaceCombobox(props: PlaceComboboxProps) {
  const {
    value,
    getFocus,
    onChange,
    onSelect,
    placeholder,
    icon = 'search',
    className = '',
    inputClassName = '',
    listPositionClassName,
    ariaLabel,
    inputRef,
    action = null,
    recentPlaces = [],
    onRemoveRecent,
  } = props;
  const form = usePlaceCombobox(props);
  const {
    t,
    listId,
    setOpen,
    activeIndex,
    setFocus,
    setResolving,
    selectionError,
    setSelectionError,
    selectionRef,
    offset,
    matches,
    showList,
    handleKeyDown,
  } = form;
  return (
    <div
      className={`relative ${className}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          selectionRef.current?.abort();
          setResolving(false);
          setOpen(false);
        }
      }}
    >
      {icon && (
        <Icon
          name={icon}
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400 dark:text-slate-500"
        />
      )}
      <Input
        ref={inputRef}
        aria-label={t(ariaLabel)}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showList && matches.length + offset > 0}
        aria-activedescendant={
          showList && activeIndex < matches.length + offset ? `${listId}-${activeIndex}` : undefined
        }
        autoComplete="off"
        className={`h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 text-sm text-slate-800 outline-none transition placeholder:text-slate-500 hover:border-slate-300 dark:hover:border-white/20 focus:border-brand-500 dark:focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-brand-100 dark:border-white/15 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800 dark:focus:ring-brand-500/30 ${icon ? 'pl-10' : 'pl-3'} pr-3 ${inputClassName}`}
        onChange={(event) => {
          selectionRef.current?.abort();
          setResolving(false);
          setSelectionError('');
          if (getFocus) setFocus(getFocus());
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (getFocus) setFocus(getFocus());
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={t(placeholder)}
        role="combobox"
        value={value}
      />
      {selectionError && (
        <p role="alert" className="mt-1 text-xs text-amber-800 dark:text-amber-200">
          {selectionError}
        </p>
      )}
      <RecentPlacesList
        onChange={onChange}
        onSelect={onSelect}
        recentPlaces={recentPlaces}
        onRemoveRecent={onRemoveRecent}
        listPositionClassName={listPositionClassName}
        form={form}
      />
      <PlaceSuggestionsList
        value={value}
        onChange={onChange}
        action={action}
        listPositionClassName={listPositionClassName}
        form={form}
      />
    </div>
  );
}
export type { ComboboxAction } from '../types';
