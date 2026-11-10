import type {
  CidadePagina,
  OrganizationJsonLd,
  PaginaMeta,
  ServiceJsonLd,
  ServicoCidadeMeta,
  ServicoPagina,
} from '../types/site.types.ts';

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

/** Monta título e description da página de um serviço, para a rota /servicos/{servico}. */
export function servicoMeta(servico: ServicoPagina): PaginaMeta {
  return { title: `${servico.busca} | Fixable`, description: servico.descricao };
}

/** Monta título, description e H1 da página de um serviço em uma cidade, para o SEO local. */
export function servicoCidadeMeta(servico: ServicoPagina, cidade: CidadePagina): ServicoCidadeMeta {
  return {
    title: `${servico.busca} em ${cidade.nome} - ${cidade.uf} | Fixable`,
    description: `${servico.descricao} Atendimento em ${cidade.nome} com engenheiro responsável e profissionais certificados. Solicite seu diagnóstico.`,
    heading: `${servico.busca} em ${cidade.nome}`,
  };
}

/** Monta o JSON-LD Service de um serviço numa cidade, com a Fixable como LocalBusiness provedora. */
export function serviceJsonLd(servico: ServicoPagina, cidade: CidadePagina, site: URL | undefined): ServiceJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: servico.nome,
    areaServed: { '@type': 'City', name: cidade.nome },
    provider: {
      '@type': 'LocalBusiness',
      name: 'Fixable',
      url: new URL('/', site).href,
      email: 'contato@fixable.com.br',
      telephone: '+55 11 90000-0000',
    },
  };
}
