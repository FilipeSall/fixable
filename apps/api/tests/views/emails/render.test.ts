import { describe, expect, it } from 'vitest';
import { renderTemplate } from '../../../src/views/emails/render.ts';

describe('renderTemplate', () => {
  const link = 'https://x/app/convite?token=abc';

  it('renderiza o convite com assunto fixo, nome e link em texto e html', () => {
    const mail = renderTemplate('convite', { nome: 'Ana', link });
    expect(mail.subject).toBe('Crie sua senha na Fixable');
    expect(mail.text).toContain(link);
    expect(mail.text).toContain('Ana');
    expect(mail.html).toContain(link);
    expect(mail.html).toContain('Ana');
  });

  it('renderiza a redefinição com assunto fixo', () => {
    const mail = renderTemplate('redefinicao', { nome: 'Ana', link });
    expect(mail.subject).toBe('Redefinição de senha da Fixable');
    expect(mail.text).toContain(link);
  });

  it('escapa html vindo do nome', () => {
    const mail = renderTemplate('convite', { nome: '<script>alert(1)</script>', link });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });

  it('renderiza o novo lead com assunto, dados e escape de html no nome', () => {
    const mail = renderTemplate('novo-lead', {
      nome: '<b>Ana</b>',
      email: 'ana@x.com',
      telefone: '11999990000',
      cidade: 'Campinas',
      tipoImovel: 'Apartamento',
      preferenciaContato: 'WhatsApp',
      plano: '—',
      descricao: 'Infiltração no banheiro',
      engenheiro: 'Sem atribuição',
    });
    expect(mail.subject).toBe('Novo diagnóstico: <b>Ana</b> (Campinas)');
    expect(mail.html).not.toContain('<b>Ana</b>');
    expect(mail.html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
    expect(mail.text).toContain('Sem atribuição');
    expect(mail.text).toContain('Infiltração no banheiro');
    expect(mail.html).toContain('Sem atribuição');
  });

  it('renderiza a nova candidatura com a área no assunto', () => {
    const mail = renderTemplate('nova-candidatura', {
      nome: 'Bia',
      email: 'bia@x.com',
      telefone: '11988887777',
      cidade: 'Santos',
      area: 'Engenharia civil',
    });
    expect(mail.subject).toBe('Nova candidatura: Bia (Engenharia civil)');
    expect(mail.text).toContain('bia@x.com');
    expect(mail.html).toContain('Santos');
  });

  it('renderiza o diagnóstico recebido com o texto fixo e o link de login', () => {
    const loginUrl = 'https://x/app/login';
    const mail = renderTemplate('diagnostico-recebido', { nome: 'Caio', loginUrl });
    expect(mail.subject).toBe('Recebemos sua nova solicitação');
    expect(mail.text).toContain('Recebemos sua nova solicitação de diagnóstico.');
    expect(mail.text).toContain('Seu engenheiro responsável vai entrar em contato.');
    expect(mail.text).toContain('Você também acompanha tudo pela plataforma.');
    expect(mail.text).toContain(loginUrl);
    expect(mail.html).toContain(`href="${loginUrl}"`);
  });
});
