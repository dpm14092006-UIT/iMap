// @vitest-environment jsdom
import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../auth/context/AuthProvider';
import { getSupabaseClient } from '../../auth/services/supabaseClient';
import { deleteCurrentPushSubscription, retryPendingPushCleanup } from '../api/webPush';
import { PushSignOutCleanup } from './PushSignOutCleanup';

vi.mock('../../auth/services/supabaseClient', () => ({
  getSupabaseClient: vi.fn(),
  supabaseConfigured: true,
}));
vi.mock('../api/webPush', () => ({
  deleteCurrentPushSubscription: vi.fn(async () => undefined),
  retryPendingPushCleanup: vi.fn(async () => undefined),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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

/** Supabase giả: phiên ban đầu cho sẵn; ghi lại thứ tự gỡ push và đăng xuất. */
function stubSupabase(initial: Session | null, calls: string[]) {
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: initial } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(async () => {
        calls.push('signOut');
        return { error: null };
      }),
    },
    realtime: { setAuth: vi.fn(async () => undefined) },
  };
  vi.mocked(getSupabaseClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof getSupabaseClient>>,
  );
  vi.mocked(deleteCurrentPushSubscription).mockImplementation(async () => {
    calls.push('deletePush');
  });
}

/** Dựng giống main.tsx: PushSignOutCleanup nằm ngay dưới AuthProvider, ngoài nhánh trang. */
function wrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PushSignOutCleanup />
      {children}
    </AuthProvider>
  );
}

describe('PushSignOutCleanup (issue #19, mục 8)', () => {
  it.each(['/login', '/'])('đăng xuất ở %s gỡ push của máy trước khi mất phiên', async (path) => {
    window.history.replaceState({}, '', path);
    const calls: string[] = [];
    stubSupabase(session('old-user'), calls);
    const { result } = renderHook(() => useAuth(), { wrapper });
    // Trang bản đồ tải Supabase khi trình duyệt rảnh (chậm nhất 1,2 giây).
    await waitFor(() => expect(result.current.user?.id).toBe('old-user'), { timeout: 3_000 });

    await act(() => result.current.signOut());

    expect(calls).toEqual(['deletePush', 'signOut']);
    expect(result.current.user).toBeNull();
  });

  it('không có ai đăng nhập: dọn đăng ký push mà lần đăng xuất trước chưa gỡ được', async () => {
    window.history.replaceState({}, '', '/login');
    stubSupabase(null, []);
    render(<PushSignOutCleanup />, { wrapper: AuthProvider });
    await waitFor(() => expect(retryPendingPushCleanup).toHaveBeenCalledOnce());
  });

  it('đang đăng nhập: không đụng tới đăng ký push của tài khoản hiện tại', async () => {
    window.history.replaceState({}, '', '/login');
    stubSupabase(session('current-user'), []);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user?.id).toBe('current-user'));
    expect(retryPendingPushCleanup).not.toHaveBeenCalled();
  });
});
