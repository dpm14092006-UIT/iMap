import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../../auth/context/AuthProvider';
import type { Place } from '../types';
import {
  emptyRecentPlaces,
  isRecordablePlace,
  pushRecentPlace,
  readCachedRecentPlaces,
  RecentPlacesRepository,
  recentPlaceKey,
  writeCachedRecentPlaces,
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

  useEffect(() => {
    if (!userId) {
      setPlaces(emptyRecentPlaces());
      return;
    }
    setPlaces(readCachedRecentPlaces(userId));
    let active = true;
    void repository
      .list()
      .then((remote) => {
        if (!active || !remote) return;
        setPlaces(remote);
        writeCachedRecentPlaces(userId, remote);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [userId]);

  const record = useCallback(
    (kind: RecentPlaceKind, place: Place | null | undefined) => {
      if (!userId || !isRecordablePlace(place)) return;
      setPlaces((current) => {
        if (current[kind][0] && recentPlaceKey(current[kind][0]) === recentPlaceKey(place)) return current;
        const next = { ...current, [kind]: pushRecentPlace(current[kind], place) };
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
      const key = recentPlaceKey(place);
      setPlaces((current) => {
        const next = { ...current, [kind]: current[kind].filter((item) => recentPlaceKey(item) !== key) };
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
