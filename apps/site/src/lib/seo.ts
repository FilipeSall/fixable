/** Serializa um objeto JSON-LD escapando `<`, para o conteúdo não fechar a tag script da página. */
export function jsonLdHtml(data: object): string {
  return JSON.stringify(data).replaceAll('<', String.raw`\u003c`);
}

/** Monta a URL canônica absoluta a partir do caminho da página, sem barra final. */
export function canonicalUrl(pathname: string, site: URL | undefined): string {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return new URL(path, site).href;
}
