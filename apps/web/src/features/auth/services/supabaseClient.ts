import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigured = Boolean(url && key);
let clientPromise: Promise<SupabaseClient | null> | null = null;

/** Tải SDK và tạo client khi cần auth, realtime hoặc lưu ảnh. */
export function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!url || !key) return Promise.resolve(null);
  clientPromise ??= import('@supabase/supabase-js')
    .then(({ createClient }) =>
      createClient(url, key, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
      }),
    )
    .catch((error: unknown) => {
      clientPromise = null;
      throw error;
    });
  return clientPromise;
}
