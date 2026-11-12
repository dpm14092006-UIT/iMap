import { z } from 'zod';
/** Biến môi trường để trống ("KEY=") được coi như chưa khai báo. */
const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;
const optionalValue = z.preprocess(emptyToUndefined, z.string().trim().optional());
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
  GEMINI_TRAFFIC_AI_ENABLED: z
    .string()
    .trim()
    .toLowerCase()
    .default('false')
    .transform((value) => value === 'true'),
  GEMINI_MODEL: z.preprocess(emptyToUndefined, z.string().trim().default('gemini-3.8-flash')),
  SUPABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  SUPABASE_PUBLISHABLE_KEY: optionalValue,
  SUPABASE_ANON_KEY: optionalValue,
  // Giới hạn lượt/phút/IP cho các endpoint gọi VietMap tính phí (bộ đếm trong RAM, theo từng instance).
  RATE_LIMIT_POI_PER_MIN: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_ROUTES_PER_MIN: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_PLACES_PER_MIN: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_OPTIMIZE_PER_MIN: z.coerce.number().int().positive().default(10),
  // Số proxy tin cậy phía trước API (Vercel/nginx = 1) để `req.ip` là IP thật; 0 = không tin X-Forwarded-For.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  // File đồ thị OSM cho Dijkstra/A* (tạo bằng `npm run osm:import`), tính từ thư mục apps/api.
  OSM_GRAPH_FILE: z.string().default('data/osm/hcmc-center.json'),
});
export const env = envSchema.parse({ ...process.env, API_PORT: process.env.API_PORT ?? process.env.PORT });
export const supabaseKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
export const supabaseConfigured = Boolean(env.SUPABASE_URL && supabaseKey);
