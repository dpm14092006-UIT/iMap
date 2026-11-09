import { z } from 'zod';
const optionalValue = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().optional(),
);
const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  OVERPASS_API_URL: z.string().url().default('https://overpass-api.de/api/interpreter'),
  STOP_AI_PROVIDER: z.enum(['off', 'gemini', 'ollama']).default('off'),
  STOP_AI_MODEL: optionalValue,
  GEMINI_API_KEY: optionalValue,
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  VOICE_STT_PROVIDER: z.enum(['off', 'cloudflare']).default('off'),
  CLOUDFLARE_ACCOUNT_ID: optionalValue,
  CLOUDFLARE_AI_TOKEN: optionalValue,
  VIETMAP_API_KEY: optionalValue,
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
  // File đồ thị OSM cho Dijkstra/A* (tạo bằng `npm run osm:import`), tính từ thư mục apps/api.
  OSM_GRAPH_FILE: z.string().default('data/osm/hcmc-center.json'),
});
export const env = envSchema.parse({ ...process.env, API_PORT: process.env.API_PORT ?? process.env.PORT });
export const supabaseKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
export const supabaseConfigured = Boolean(env.SUPABASE_URL && supabaseKey);
