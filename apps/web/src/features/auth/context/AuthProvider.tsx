import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient, supabaseConfigured } from '../services/supabaseClient';

type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  configured: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const timer = window.setTimeout(
      () => {
        void (async () => {
          try {
            const client = await getSupabaseClient();
            if (!active || !client) return;
            const {
              data: { subscription },
            } = client.auth.onAuthStateChange((_event, nextSession) => {
              setSession(nextSession);
              if (nextSession?.access_token)
                void client.realtime.setAuth(nextSession.access_token).catch(() => undefined);
            });
            unsubscribe = () => subscription.unsubscribe();
            const { data } = await client.auth.getSession();
            if (!active) return;
            setSession(data.session);
            if (data.session?.access_token)
              void client.realtime.setAuth(data.session.access_token).catch(() => undefined);
          } catch {
            if (active) setSession(null);
          } finally {
            if (active) setLoading(false);
          }
        })();
      },
      supabaseConfigured ? 1200 : 0,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
      unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = await getSupabaseClient();
    if (!client) throw new Error('Chưa cấu hình Supabase Auth.');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setSession(data.session);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const client = await getSupabaseClient();
    if (!client) throw new Error('Chưa cấu hình Supabase Auth.');
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    if (data.session) setSession(data.session);
    return Boolean(data.session);
  }, []);

  const signOut = useCallback(async () => {
    const client = await getSupabaseClient();
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
    setSession(null);
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
    }),
    [session, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
