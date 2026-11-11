import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, supabaseConfigured, supabaseKey } from '../../config/env.js';
import { AppError } from '../errors/AppError.js';

const supabaseFetch: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(10_000);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
};

/** Creates a request-scoped Supabase client so Postgres sees the caller's JWT and enforces RLS. */
export class SupabaseClientFactory {
  create(accessToken?: string): SupabaseClient {
    if (!supabaseConfigured || !env.SUPABASE_URL || !supabaseKey) {
      throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Dịch vụ dữ liệu chưa được cấu hình');
    }
    return createClient(env.SUPABASE_URL, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: {
        fetch: supabaseFetch,
        ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
      },
    });
  }
}
