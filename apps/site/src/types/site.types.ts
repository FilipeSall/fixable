export type SeoProps = {
  title: string;
  description: string;
  jsonLd?: object[];
  noindex?: boolean;
};

export type IconProps = {
  name: string;
  class?: string;
};

export type IconSymbol = {
  attributes: Record<string, string>;
  body: string;
};

export type CertBadgeProps = {
  large?: boolean;
};

export type OrganizationJsonLd = {
  '@context': 'https://schema.org';
  '@type': 'Organization';
  name: string;
  url: string;
  email: string;
  telephone: string;
  logo: string;
};

export type ServicoPagina = {
  id: string;
  nome: string;
  busca: string;
  descricao: string;
};

export type CidadePagina = {
  id: string;
  nome: string;
  uf: string;
};

export type PaginaMeta = {
  title: string;
  description: string;
};

export type ServicoCidadeMeta = PaginaMeta & {
  heading: string;
};

export type ServiceJsonLd = {
  '@context': 'https://schema.org';
  '@type': 'Service';
  serviceType: string;
  areaServed: { '@type': 'City'; name: string };
  provider: {
    '@type': 'LocalBusiness';
    name: string;
    url: string;
    email: string;
    telephone: string;
  };
};

export type PassoComoFunciona = {
  titulo: string;
  texto: string;
};
