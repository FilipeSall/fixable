import { describe, expect, it } from 'vitest';
import { renderTemplate } from '../../../src/views/emails/render.ts';

const dados = {
  nome: 'Marina',
  acao: 'criado' as const,
  servico: 'Revisão elétrica',
  imovel: 'Casa principal',
  data: '20/11/2026',
  hora: '09:30',
  status: 'Pendente · requer confirmação',
  link: 'http://localhost:4321/app/cliente',
};

describe('template agendamento', () => {
  it('monta o assunto com a ação e o serviço e o corpo com data, hora, status e link', () => {
    const mail = renderTemplate('agendamento', dados);
    expect(mail.subject).toBe('Agendamento criado: Revisão elétrica');
    for (const trecho of ['Marina', 'Casa principal', '20/11/2026', '09:30', 'Pendente · requer confirmação']) {
      expect(mail.text).toContain(trecho);
    }
    expect(mail.text).toContain('http://localhost:4321/app/cliente');
    expect(mail.html).toContain('href="http://localhost:4321/app/cliente"');
  });

  it('usa "atualizado" na alteração e escapa o html do serviço', () => {
    const mail = renderTemplate('agendamento', { ...dados, acao: 'atualizado', servico: '<b>Pintura</b>' });
    expect(mail.subject).toBe('Agendamento atualizado: <b>Pintura</b>');
    expect(mail.html).not.toContain('<b>Pintura</b>');
    expect(mail.html).toContain('&lt;b&gt;Pintura&lt;/b&gt;');
  });
});
