import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../../auth/context/AuthProvider';
import type { Place } from '../types';
import {
  applyRecentPlaceEdit,
  emptyRecentPlaces,
  isRecordablePlace,
  mergeRemoteRecentPlaces,
  readCachedRecentPlaces,
  RecentPlacesRepository,
  recentPlaceKey,
  writeCachedRecentPlaces,
  type RecentPlaceEdit,
  type RecentPlaceKind,
  type RecentPlaces,
} from '../services/recentPlaces';

type RecentPlacesContextValue = {
  /** Chỉ có khi đã đăng nhập bằng tài khoản thật. */
  enabled: boolean;
  places: RecentPlaces;
  record: (kind: RecentPlaceKind, place: Place | null | undefined) => void;
  remove: (kind: RecentPlaceKind, place: Place) => void;
};

const RecentPlacesContext = createContext<RecentPlacesContextValue>({
  enabled: false,
  places: emptyRecentPlaces(),
  record: () => undefined,
  remove: () => undefined,
});

const repository = new RecentPlacesRepository();

/** 10 điểm đi + 10 điểm đến gần nhất của tài khoản: hiện ngay từ bản sao trên máy, đồng bộ với Supabase. */
export function RecentPlacesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user && !user.is_anonymous ? user.id : null;
  const [places, setPlaces] = useState<RecentPlaces>(emptyRecentPlaces);
  /**
   * Các thao tác thêm/xóa xảy ra khi danh sách server chưa về; null = đã tải xong, không cần ghi lại.
   * Khi kết quả server về sẽ áp lại các thao tác này thay vì ghi đè chúng.
   */
  const pendingEdits = useRef<RecentPlaceEdit[] | null>(null);

  useEffect(() => {
    if (!userId) {
      setPlaces(emptyRecentPlaces());
      return;
    }
    setPlaces(readCachedRecentPlaces(userId));
    let active = true;
    pendingEdits.current = [];
    void repository
      .list()
      .then((remote) => {
        if (!active || !remote) return;
        const merged = mergeRemoteRecentPlaces(remote, pendingEdits.current ?? []);
        pendingEdits.current = null;
        setPlaces(merged);
        writeCachedRecentPlaces(userId, merged);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) pendingEdits.current = null;
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const record = useCallback(
    (kind: RecentPlaceKind, place: Place | null | undefined) => {
      if (!userId || !isRecordablePlace(place)) return;
      const edit: RecentPlaceEdit = { type: 'record', kind, place };
      pendingEdits.current?.push(edit);
      setPlaces((current) => {
        if (current[kind][0] && recentPlaceKey(current[kind][0]) === recentPlaceKey(place)) return current;
        const next = applyRecentPlaceEdit(current, edit);
        writeCachedRecentPlaces(userId, next);
        return next;
      });
      void repository.record(kind, place).catch(() => undefined);
    },
    [userId],
  );

  const remove = useCallback(
    (kind: RecentPlaceKind, place: Place) => {
      if (!userId) return;
      const edit: RecentPlaceEdit = { type: 'remove', kind, key: recentPlaceKey(place) };
      pendingEdits.current?.push(edit);
      setPlaces((current) => {
        const next = applyRecentPlaceEdit(current, edit);
        writeCachedRecentPlaces(userId, next);
        return next;
      });
      void repository.remove(kind, place).catch(() => undefined);
    },
    [userId],
  );

  const value = useMemo(
    () => ({ enabled: Boolean(userId), places, record, remove }),
    [userId, places, record, remove],
  );
  return <RecentPlacesContext.Provider value={value}>{children}</RecentPlacesContext.Provider>;
}

export function useRecentPlaces() {
  return useContext(RecentPlacesContext);
}
