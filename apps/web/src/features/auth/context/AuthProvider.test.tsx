// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deferred } from '../../../testing/fixtures';
import { getSupabaseClient } from '../services/supabaseClient';
import { AuthProvider, useAuth } from './AuthProvider';

vi.mock('../services/supabaseClient', () => ({ getSupabaseClient: vi.fn(), supabaseConfigured: true }));
afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

function session(id: string): Session {
  return {
    access_token: `token-${id}`,
    refresh_token: 'refresh',
    token_type: 'bearer',
    expires_in: 3600,
    user: {
      id,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-11-20T00:00:00Z',
    },
  };
}

async function setup() {
  window.history.replaceState({}, '', '/login');
  const initial = deferred<{ data: { session: Session | null } }>();
  let changed!: (event: AuthChangeEvent, value: Session | null) => void;
  const client = {
    auth: {
      getSession: vi.fn(() => initial.promise),
      onAuthStateChange: vi.fn((callback: typeof changed) => {
        changed = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
    realtime: { setAuth: vi.fn(async () => undefined) },
  };
  vi.mocked(getSupabaseClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof getSupabaseClient>>,
  );
  const hook = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await act(async () => {
    await Promise.resolve();
  });
  return {
    ...hook,
    initial,
    client,
    changed: (event: AuthChangeEvent, value: Session | null) => changed(event, value),
  };
}

describe('authentication bootstrap event ordering', () => {
  it('does not restore an old session when getSession completes after SIGNED_OUT', async () => {
    const { result, initial, changed } = await setup();
    act(() => changed('SIGNED_OUT', null));
    await act(async () => {
      initial.resolve({ data: { session: session('old-user') } });
      await initial.promise;
    });
    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('does not replace a newer signed-in account with the stale bootstrap result', async () => {
    const { result, initial, changed } = await setup();
    act(() => changed('SIGNED_IN', session('new-user')));
    await act(async () => {
      initial.resolve({ data: { session: session('old-user') } });
      await initial.promise;
    });
    expect(result.current.user?.id).toBe('new-user');
    expect(result.current.accessToken).toBe('token-new-user');
  });

  it('keeps the latest auth event when bootstrap fails', async () => {
    const { result, initial, changed } = await setup();
    act(() => changed('SIGNED_IN', session('new-user')));
    await act(async () => {
      initial.reject(new Error('bootstrap offline'));
      await initial.promise.catch(() => undefined);
    });
    expect(result.current.user?.id).toBe('new-user');
    expect(result.current.loading).toBe(false);
  });

  it('ignores a queued auth callback after the provider unmounts', async () => {
    const { unmount, changed, client, initial } = await setup();
    unmount();
    changed('SIGNED_IN', session('new-user'));
    initial.resolve({ data: { session: null } });
    await initial.promise;
    expect(client.realtime.setAuth).not.toHaveBeenCalled();
  });
});
