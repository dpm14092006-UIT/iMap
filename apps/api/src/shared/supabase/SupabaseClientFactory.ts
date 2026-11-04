import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, supabaseConfigured, supabaseKey } from '../../config/env.js';
import { AppError } from '../errors/AppError.js';

/** Creates a request-scoped Supabase client so Postgres sees the caller's JWT and enforces RLS. */
export class SupabaseClientFactory {
  create(accessToken?: string): SupabaseClient {
    if (!supabaseConfigured || !env.SUPABASE_URL || !supabaseKey) {
      throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Dịch vụ dữ liệu chưa được cấu hình');
    }
    return createClient(env.SUPABASE_URL, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
    });
  }

  createAdmin(): SupabaseClient {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new AppError(503, 'SUPABASE_ADMIN_NOT_CONFIGURED', 'Dịch vụ lưu kết quả chưa được cấu hình');
    }
    return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
  }
}
