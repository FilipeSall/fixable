import type { AstroIntegration } from 'astro';

/** Decide se uma requisição GET a /app/ deve ser reescrita para a raiz do app de página única. */
export function shouldRewrite(method: string | undefined, url: string | undefined): boolean {
  if (method !== 'GET' || !url) return false;
  const path = url.split('?')[0] ?? '';
  if (!path.startsWith('/app/') || path === '/app/') return false;
  const lastSegment = path.split('/').pop() ?? '';
  return !lastSegment.includes('.');
}

/** Integração do Astro que serve o app de página única em qualquer caminho de /app no servidor de desenvolvimento. */
export function spaFallback(): AstroIntegration {
  return {
    name: 'spa-fallback',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((req, _res, next) => {
          if (shouldRewrite(req.method, req.url)) {
            const queryStart = req.url?.indexOf('?') ?? -1;
            const query = queryStart >= 0 ? (req.url?.slice(queryStart) ?? '') : '';
            req.url = `/app/${query}`;
          }
          next();
        });
      },
    },
  };
}
