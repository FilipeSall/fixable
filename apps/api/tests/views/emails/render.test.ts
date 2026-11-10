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
});
