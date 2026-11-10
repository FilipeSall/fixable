import process from 'node:process';
import { URL } from 'node:url';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { spaFallback } from './src/integrations/spa-fallback.ts';

const PAGINAS_FORA_DO_SITEMAP = ['/termos-de-uso', '/privacidade'];

/** Diz se a página entra no sitemap, deixando de fora o app autenticado e as páginas legais. */
function entraNoSitemap(page) {
  const { pathname } = new URL(page);
  const path = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (path === '/app' || path.startsWith('/app/')) return false;
  return !PAGINAS_FORA_DO_SITEMAP.includes(path);
}

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://www.fixable.com.br',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'directory' },
  integrations: [react(), sitemap({ filter: entraNoSitemap }), spaFallback()],
  vite: {
    server: {
      proxy: { '/api': 'http://localhost:3333' },
    },
    ssr: { noExternal: ['@fixable/shared'] },
  },
});
