import { describe, expect, it } from 'vitest';
import { canonicalUrl, jsonLdHtml } from './seo.ts';

const SITE = new URL('https://www.fixable.com.br');

describe('canonicalUrl', () => {
  it('monta a URL absoluta a partir do site, sem barra final', () => {
    expect(canonicalUrl('/servicos/eletrica', SITE)).toBe('https://www.fixable.com.br/servicos/eletrica');
    expect(canonicalUrl('/privacidade/', SITE)).toBe('https://www.fixable.com.br/privacidade');
  });

  it('mantém a raiz como /', () => {
    expect(canonicalUrl('/', SITE)).toBe('https://www.fixable.com.br/');
  });
});

describe('jsonLdHtml', () => {
  it('escapa < para o JSON não fechar a tag script', () => {
    const html = jsonLdHtml({ name: '</script><script>alert(1)</script>' });
    expect(html).not.toContain('<');
    expect(JSON.parse(html)).toEqual({ name: '</script><script>alert(1)</script>' });
  });
});
