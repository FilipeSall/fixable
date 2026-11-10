import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { spaFallback } from './src/integrations/spa-fallback.ts';

export default defineConfig({
  output: 'static',
  integrations: [react(), spaFallback()],
  vite: {
    server: {
      proxy: { '/api': 'http://localhost:3333' },
    },
    ssr: { noExternal: ['@fixable/shared'] },
  },
});
