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
  isMostRecentPlace,
  isRecordablePlace,
  mergeRemoteRecentPlaces,
  recentPlaceKey,
  type RecentPlaceEdit,
  type RecentPlaceKind,
  type RecentPlaces,
} from '../domain/recentPlaces';
import {
  readCachedRecentPlaces,
  RecentPlacesRepository,
  writeCachedRecentPlaces,
} from '../services/recentPlacesStore';

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

/**
 * Đồng bộ lên tài khoản thất bại không chặn người dùng (bản trên máy vẫn còn và lần tải sau sẽ khớp lại),
 * nhưng ghi ra console để còn biết mà sửa thay vì im lặng.
 */
const warnSyncFailure = (error: unknown) => console.warn('[recent-places]', error);

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
  /** Danh sách mới nhất, đọc được trong callback mà không cần đưa `places` vào dependency. */
  const placesRef = useRef(places);
  placesRef.current = places;

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
      // Đã đứng đầu danh sách thì không đổi gì: bỏ qua luôn, không gọi RPC lên server.
      if (isMostRecentPlace(placesRef.current[kind], place)) return;
      const edit: RecentPlaceEdit = { type: 'record', kind, place };
      pendingEdits.current?.push(edit);
      setPlaces((current) => {
        if (isMostRecentPlace(current[kind], place)) return current;
        const next = applyRecentPlaceEdit(current, edit);
        writeCachedRecentPlaces(userId, next);
        return next;
      });
      void repository.record(kind, place).catch(warnSyncFailure);
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
      void repository.remove(kind, place).catch(warnSyncFailure);
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
