import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { env } from 'node:process';

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

export default defineConfig({
  plugins: [react(), appVersionPlugin(appBuildVersion)],
  define: { __APP_BUILD_VERSION__: JSON.stringify(appBuildVersion) },
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://localhost:4000' } },
});
