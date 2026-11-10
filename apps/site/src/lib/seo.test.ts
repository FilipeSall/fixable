import { describe, expect, it } from 'vitest';
import { canonicalUrl, jsonLdHtml, organizationJsonLd, serviceJsonLd, servicoCidadeMeta, servicoMeta } from './seo.ts';

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

describe('organizationJsonLd', () => {
  it('descreve a Fixable com URL e logo absolutos a partir do site', () => {
    expect(organizationJsonLd(SITE)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Fixable',
      url: 'https://www.fixable.com.br/',
      email: 'contato@fixable.com.br',
      telephone: '+55 11 90000-0000',
      logo: 'https://www.fixable.com.br/logo.svg',
    });
  });
});

const ELETRICA = {
  id: 'eletrica',
  nome: 'Elétrica',
  busca: 'Eletricista',
  descricao: 'Instalações, reparos e troca de quadros e pontos.',
};
const SANTO_ANDRE = { id: 'santo-andre', nome: 'Santo André', uf: 'SP' };

describe('servicoMeta', () => {
  it('monta título e description da página do serviço', () => {
    expect(servicoMeta(ELETRICA)).toEqual({
      title: 'Eletricista | Fixable',
      description: 'Instalações, reparos e troca de quadros e pontos.',
    });
  });
});

describe('servicoCidadeMeta', () => {
  it('monta título, description e H1 de eletrica x santo-andre', () => {
    expect(servicoCidadeMeta(ELETRICA, SANTO_ANDRE)).toEqual({
      title: 'Eletricista em Santo André - SP | Fixable',
      description:
        'Instalações, reparos e troca de quadros e pontos. Atendimento em Santo André com engenheiro responsável e profissionais certificados. Solicite seu diagnóstico.',
      heading: 'Eletricista em Santo André',
    });
  });
});

describe('serviceJsonLd', () => {
  it('descreve o serviço com areaServed na cidade e provider LocalBusiness', () => {
    expect(serviceJsonLd(ELETRICA, SANTO_ANDRE, SITE)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Service',
      serviceType: 'Elétrica',
      areaServed: { '@type': 'City', name: 'Santo André' },
      provider: {
        '@type': 'LocalBusiness',
        name: 'Fixable',
        url: 'https://www.fixable.com.br/',
        email: 'contato@fixable.com.br',
        telephone: '+55 11 90000-0000',
      },
    });
  });
});
