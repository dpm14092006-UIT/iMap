/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { env } from 'node:process';
import { buildContentSecurityPolicy } from './src/shared/security/contentSecurityPolicy';

const appBuildVersion = `${env.VERCEL_DEPLOYMENT_ID ?? env.VERCEL_GIT_COMMIT_SHA ?? 'local'}-${Date.now().toString(36)}`;

function appVersionPlugin(version: string): Plugin {
  return {
    name: 'app-version',
    configureServer(server) {
      server.middlewares.use('/app-version.json', (_request, response) => {
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store, max-age=0');
        response.end(JSON.stringify({ version }));
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'app-version.json',
        source: JSON.stringify({ version }),
      });
    },
  };
}

/** Địa chỉ công khai của trang (để og:image/og:url là URL tuyệt đối như Facebook/Zalo yêu cầu). */
function publicSiteUrl(): string | undefined {
  const explicit = env.VITE_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercel ? `https://${vercel}` : undefined;
}

/**
 * Chỉ khi build: thêm CSP (dựng từ API/Supabase cấu hình) và ảnh xem trước khi chia sẻ dạng URL tuyệt đối.
 * Không áp lúc dev vì Vite/React Refresh cần script nội tuyến.
 */
function htmlSecurityAndPreviewPlugin(): Plugin {
  let policy = '';
  return {
    name: 'imap-html-security-preview',
    apply: 'build',
    configResolved(config) {
      policy = buildContentSecurityPolicy({
        apiBaseUrl: config.env.VITE_API_BASE_URL,
        supabaseUrl: config.env.VITE_SUPABASE_URL,
      });
    },
    transformIndexHtml(html) {
      const site = publicSiteUrl();
      const image = `${site ?? ''}/og-image.jpg`;
      const escaped = policy.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
      // CSP ngay sau charset: phải đứng trước mọi script/stylesheet mà nó quản lý.
      return {
        html: html.replace(
          /<meta charset="UTF-8" \/>/,
          (charset) => `${charset}\n    <meta http-equiv="Content-Security-Policy" content="${escaped}" />`,
        ),
        tags: [
          { tag: 'meta', attrs: { property: 'og:image', content: image }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'twitter:image', content: image }, injectTo: 'head' },
          ...(site
            ? [
                {
                  tag: 'meta',
                  attrs: { property: 'og:url', content: `${site}/` },
                  injectTo: 'head' as const,
                },
                { tag: 'link', attrs: { rel: 'canonical', href: `${site}/` }, injectTo: 'head' as const },
              ]
            : []),
        ],
      };
    },
  };
}

export default defineConfig({
  plugins: [react(), appVersionPlugin(appBuildVersion), htmlSecurityAndPreviewPlugin()],
  define: { __APP_BUILD_VERSION__: JSON.stringify(appBuildVersion) },
  // Node 25+ có localStorage riêng (rỗng nếu thiếu --localstorage-file), che mất localStorage của jsdom.
  test: { execArgv: ['--no-experimental-webstorage'] },
  build: {
    rollupOptions: {
      output: {
        // Tách thư viện ít đổi để trình duyệt cache lâu; Supabase đã là chunk động riêng (import()).
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (id.includes('node_modules/leaflet/')) return 'vendor-leaflet';
          if (/node_modules\/(@supabase|iceberg-js)\//.test(id)) return 'vendor-supabase';
          return undefined;
        },
      },
    },
  },
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://localhost:4000' } },
});
