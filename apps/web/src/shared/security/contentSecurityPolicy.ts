/**
 * Content-Security-Policy cho bản build: chỉ cho tải mã từ chính trang, ảnh bản đồ từ các máy chủ
 * ô bản đồ đang dùng, và gọi mạng tới API + Supabase cấu hình lúc build. Dùng ở vite.config.ts
 * (thẻ <meta> trong index.html), không dùng lúc dev vì Vite cần script nội tuyến cho HMR.
 */

/**
 * Máy chủ ô ảnh (raster) tải thẳng từ trình duyệt — phải khớp các URL tuyệt đối trong
 * features/map/basemap/providers.ts (có test kiểm tra). VNSDI Sentinel-2 công khai, không cần token.
 * Các nguồn cần khóa/token (Vietmap, VNSDI hành chính/địa hình) đi qua proxy của API.
 */
export const MAP_TILE_SOURCES = ['https://vnsdi.mae.gov.vn'] as const;

/**
 * Bản đồ vector tải thẳng từ trình duyệt (MapLibre dùng fetch cho style, ô vector, font):
 * vApp cho hiển thị miễn phí, không cần khóa (xem features/map/services/leaflet/VappLayer.ts).
 */
export const MAP_STYLE_SOURCES = ['https://map.vapp.vn'] as const;

export type CspConfig = {
  /** VITE_API_BASE_URL; đường dẫn tương đối ("/api") nghĩa là cùng nguồn. */
  apiBaseUrl?: string | undefined;
  /** VITE_SUPABASE_URL. */
  supabaseUrl?: string | undefined;
};

/** Nguồn (scheme://host[:port]) của một URL tuyệt đối http(s); URL tương đối hay sai thì bỏ qua. */
function absoluteOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

export function buildContentSecurityPolicy({ apiBaseUrl, supabaseUrl }: CspConfig): string {
  const api = absoluteOrigin(apiBaseUrl);
  const supabase = absoluteOrigin(supabaseUrl);
  // Supabase Realtime dùng WebSocket trên cùng host.
  const supabaseSocket = supabase?.replace(/^http/, 'ws');
  const list = (...items: (string | undefined)[]) =>
    [...new Set(items.filter((item): item is string => Boolean(item)))].join(' ');
  const directives: Record<string, string> = {
    'default-src': "'self'",
    'script-src': "'self'",
    // Leaflet và React đặt style trực tiếp trên phần tử (vị trí ô bản đồ, marker).
    'style-src': "'self' 'unsafe-inline'",
    // data: biểu tượng SVG nội tuyến; blob: ảnh xem trước khi báo cáo; Supabase: ảnh báo cáo (link ký).
    // API: ô ảnh VNSDI qua proxy /api/map/vnsdi.
    'img-src': list("'self'", 'data:', 'blob:', ...MAP_TILE_SOURCES, api, supabase),
    'connect-src': list("'self'", api, supabase, supabaseSocket, ...MAP_STYLE_SOURCES),
    'font-src': "'self'",
    'worker-src': "'self'",
    'manifest-src': "'self'",
    'media-src': "'self'",
    'object-src': "'none'",
    'base-uri': "'self'",
    'form-action': "'self'",
  };
  return Object.entries(directives)
    .map(([name, value]) => `${name} ${value}`)
    .join('; ');
}
