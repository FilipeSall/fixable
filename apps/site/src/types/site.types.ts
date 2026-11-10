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
