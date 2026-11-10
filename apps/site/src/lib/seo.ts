import type { OrganizationJsonLd } from '../types/site.types.ts';

/** Serializa um objeto JSON-LD escapando `<`, para o conteúdo não fechar a tag script da página. */
export function jsonLdHtml(data: object): string {
  return JSON.stringify(data).replaceAll('<', String.raw`\u003c`);
}

/** Monta a URL canônica absoluta a partir do caminho da página, sem barra final. */
export function canonicalUrl(pathname: string, site: URL | undefined): string {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return new URL(path, site).href;
}

/** Monta o JSON-LD Organization da Fixable com URLs absolutas, para a home se identificar aos buscadores. */
export function organizationJsonLd(site: URL | undefined): OrganizationJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Fixable',
    url: new URL('/', site).href,
    email: 'contato@fixable.com.br',
    telephone: '+55 11 90000-0000',
    logo: new URL('/logo.svg', site).href,
  };
}
