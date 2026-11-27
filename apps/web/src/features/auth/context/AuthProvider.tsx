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
import type { Session, User } from '@supabase/supabase-js';
import { httpClient } from '../../../shared/api/HttpClient';
import { whenIdle } from '../../../shared/async/whenIdle';
import { runSignOutTasks, type SignOutTask } from '../domain/signOutTasks';
import { getSupabaseClient, supabaseConfigured } from '../services/supabaseClient';

type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  configured: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  /**
   * Đăng ký việc chạy ngay trước khi đăng xuất (vẫn còn phiên để gọi Supabase), ví dụ xóa đăng ký
   * thông báo đẩy của máy này. Trả về hàm hủy đăng ký.
   */
  onBeforeSignOut: (task: SignOutTask) => () => void;
};

/** Chờ tối đa bao lâu (ms) trước khi tải SDK Supabase khi mở trang chính. */
const AUTH_INIT_MAX_DELAY_MS = 1200;

const isLoginPage = () => window.location.pathname.replace(/\/+$/, '') === '/login';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const signOutTasks = useRef(new Set<SignOutTask>());

  useEffect(() => {
    let active = true;
    let receivedAuthEvent = false;
    let unsubscribe: (() => void) | undefined;
    const init = () => {
      void (async () => {
        try {
          const client = await getSupabaseClient();
          if (!active || !client) return;
          const {
            data: { subscription },
          } = client.auth.onAuthStateChange((_event, nextSession) => {
            if (!active) return;
            receivedAuthEvent = true;
            setSession(nextSession);
            setLoading(false);
            if (nextSession?.access_token)
              void client.realtime.setAuth(nextSession.access_token).catch(() => undefined);
          });
          // Mọi yêu cầu cần đăng nhập lấy token còn hạn ngay lúc gửi, không dùng token cũ trong state.
          httpClient.setAccessTokenProvider({
            current: async () => (await client.auth.getSession()).data.session?.access_token ?? null,
            refresh: async () => (await client.auth.refreshSession()).data.session?.access_token ?? null,
          });
          unsubscribe = () => {
            subscription.unsubscribe();
            httpClient.setAccessTokenProvider(null);
          };
          const { data } = await client.auth.getSession();
          if (!active || receivedAuthEvent) return;
          setSession(data.session);
          if (data.session?.access_token)
            void client.realtime.setAuth(data.session.access_token).catch(() => undefined);
        } catch {
          if (active && !receivedAuthEvent) setSession(null);
        } finally {
          if (active) setLoading(false);
        }
      })();
    };
    // SDK Supabase khá nặng: tải khi trình duyệt rảnh sau khi vẽ bản đồ (thường chỉ vài chục ms),
    // chậm nhất AUTH_INIT_MAX_DELAY_MS, thay vì luôn chờ cứng 1,2 giây. Trang /login thì tải ngay.
    let cancelInit = () => {};
    if (supabaseConfigured && !isLoginPage()) cancelInit = whenIdle(init, AUTH_INIT_MAX_DELAY_MS);
    else init();
    return () => {
      active = false;
      cancelInit();
      unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = await getSupabaseClient();
    if (!client) throw new Error('Chức năng đăng nhập chưa được cấu hình trên máy chủ.');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setSession(data.session);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const client = await getSupabaseClient();
    if (!client) throw new Error('Chức năng đăng nhập chưa được cấu hình trên máy chủ.');
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    if (data.session) setSession(data.session);
    return Boolean(data.session);
  }, []);

  const signOut = useCallback(async () => {
    const client = await getSupabaseClient();
    if (!client) return;
    await runSignOutTasks(signOutTasks.current);
    const { error } = await client.auth.signOut();
    if (error) throw error;
    setSession(null);
  }, []);

  const onBeforeSignOut = useCallback((task: SignOutTask) => {
    signOutTasks.current.add(task);
    return () => {
      signOutTasks.current.delete(task);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.access_token ?? null,
      configured: supabaseConfigured,
      loading,
      signIn,
      signUp,
      signOut,
      onBeforeSignOut,
    }),
    [session, loading, signIn, signUp, signOut, onBeforeSignOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
