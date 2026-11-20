import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { LatLng } from '../../../shared/geo/types';
import { useI18n } from '../../../shared/i18n/I18nProvider';
import { foldVietnamese } from '../../../shared/text/foldVietnamese';
import { placeApi } from '../api/placeApi';
import { isSamePlace } from '../domain/sameSuggestion';
import { MIN_QUERY_LENGTH, usePlaceSearch } from '../hooks/usePlaceSearch';
import type { ComboboxAction, PlaceComboboxProps, PlaceSearchSuggestion } from '../types';

export function usePlaceCombobox({
  value,
  places,
  onChange,
  onSelect,
  maxSuggestions = 6,
  action = null,
  recentPlaces = [],
  recentActive = false,
}: PlaceComboboxProps) {
  const { t } = useI18n();

  const listId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchKind, setSearchKind] = useState<'all' | 'street'>('all');
  const [focus, setFocus] = useState<LatLng>({ lat: 10.779, lng: 106.701 });
  const [resolving, setResolving] = useState(false);
  const [selectionError, setSelectionError] = useState('');

  const selectionRef = useRef<AbortController | null>(null);

  useEffect(() => {
    selectionRef.current?.abort();
    setResolving(false);
    setSelectionError('');
  }, [value]);

  useEffect(() => () => selectionRef.current?.abort(), []);

  const {
    results: remotePlaces,
    status,
    error: searchError,
  } = usePlaceSearch(value, focus, open, searchKind);

  // Dòng thao tác được chọn sẵn (Enter chạy nó) khi từ khóa là danh mục, hoặc không địa điểm nào
  // chứa đúng chữ đã gõ; ngược lại Enter chọn địa điểm đầu tiên.
  const offset = action ? 1 : 0;

  const typed = value.trim().toLocaleLowerCase('vi');

  const preferAction =
    action !== null &&
    (action.preferred || !remotePlaces.some((place) => place.name.toLocaleLowerCase('vi').includes(typed)));

  useEffect(() => {
    setActiveIndex(preferAction ? 0 : offset);
  }, [value, preferAction, offset]);

  // Gộp địa điểm có sẵn (ưu tiên) với kết quả từ API, bỏ trùng và giới hạn số lượng.
  const matches = useMemo(() => {
    const query = foldVietnamese(value);
    if (query.length < MIN_QUERY_LENGTH) return [];
    const local = (searchKind === 'street' ? [] : places).filter((place) =>
      foldVietnamese(`${place.name} ${place.address} ${place.category}`).includes(query),
    );
    const remainingLocal = local.filter(
      (place) => !remotePlaces.some((candidate) => isSamePlace(place, candidate)),
    );
    return [...remotePlaces, ...remainingLocal].slice(0, maxSuggestions);
  }, [maxSuggestions, places, remotePlaces, value, searchKind]);

  const showRecent = open && recentActive && recentPlaces.length > 0;

  const showList = open && !showRecent && value.trim().length >= MIN_QUERY_LENGTH;

  const choose = async (suggestion: PlaceSearchSuggestion) => {
    selectionRef.current?.abort();
    const controller = new AbortController();
    selectionRef.current = controller;
    setResolving(true);
    setSelectionError('');
    try {
      const place = await placeApi.resolve(suggestion, controller.signal);
      if (controller.signal.aborted) return;
      onChange(place.name);
      onSelect(place);
      setOpen(false);
    } catch (cause) {
      if (!controller.signal.aborted)
        setSelectionError(t(cause instanceof Error ? cause.message : 'Không lấy được tọa độ địa điểm.'));
    } finally {
      if (!controller.signal.aborted) setResolving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      if (open) event.preventDefault();
      setOpen(false);
      selectionRef.current?.abort();
      setResolving(false);
    }
    if (resolving) {
      if (event.key === 'Enter') event.preventDefault();
      return;
    }
    const total = matches.length + offset;
    if (!showList || total === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => (Math.min(current, total - 1) + step + total) % total);
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const index = Math.min(activeIndex, total - 1);
      if (action && index === 0) runAction(action);
      else void choose(matches[index - offset]!);
    }
  };

  const runAction = (current: ComboboxAction) => {
    selectionRef.current?.abort();
    setResolving(false);
    setOpen(false);
    current.onRun();
  };

  /** Thông báo khi danh sách trống, tùy theo trạng thái gọi API. */
  const emptyMessage =
    status === 'loading'
      ? t('Đang tìm địa điểm…')
      : status === 'error'
        ? t(searchError || 'Không kết nối được dịch vụ tìm kiếm. Thử lại hoặc chọn trên bản đồ.')
        : t('Chưa tìm thấy địa chỉ phù hợp. Thử thêm phường, tỉnh/thành hoặc chọn điểm trên bản đồ.');
  return {
    t,
    listId,
    setOpen,
    activeIndex,
    setActiveIndex,
    searchKind,
    setSearchKind,
    setFocus,
    resolving,
    setResolving,
    selectionError,
    setSelectionError,
    selectionRef,
    remotePlaces,
    status,
    offset,
    matches,
    showRecent,
    showList,
    choose,
    handleKeyDown,
    runAction,
    emptyMessage,
  };
}
