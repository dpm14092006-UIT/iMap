import { z } from 'zod';
const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  VIETMAP_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  // File đồ thị OSM cho Dijkstra/A* (tạo bằng `npm run osm:import`), tính từ thư mục apps/api.
  OSM_GRAPH_FILE: z.string().default('data/osm/hcmc-center.json'),
});
export const env = envSchema.parse(process.env);
