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
