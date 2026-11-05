import { z } from 'zod';
const optionalValue = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().optional(),
);
const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  VIETMAP_API_KEY: optionalValue,
  GEMINI_API_KEY: optionalValue,
  GEMINI_TRAFFIC_AI_ENABLED: z.string().trim().toLowerCase().default('false').transform((value) => value === 'true'),
  GEMINI_MODEL: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().trim().default('gemini-3.8-flash'),
  ),
  SUPABASE_URL: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().url().optional(),
  ),
  SUPABASE_PUBLISHABLE_KEY: optionalValue,
  SUPABASE_ANON_KEY: optionalValue,
});
export const env = envSchema.parse(process.env);
export const supabaseKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
export const supabaseConfigured = Boolean(env.SUPABASE_URL && supabaseKey);
