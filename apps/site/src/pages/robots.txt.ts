import type { APIRoute } from 'astro';

/** Responde o robots.txt liberando o site público, bloqueando o app e apontando o sitemap. */
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('/sitemap-index.xml', site).href;
  const body = `User-agent: *\nAllow: /\nDisallow: /app/\nSitemap: ${sitemap}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
