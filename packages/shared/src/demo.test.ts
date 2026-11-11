import { describe, expect, it } from 'vitest';
import { DEMO_SENHA, demoAccountsResponse, isDemoEmail } from './demo.ts';
import { teamInviteInput } from './platform.ts';
import { applicationInput, diagnosticInput } from './public-forms.ts';

const RESERVADO = 'Este domínio de e-mail é reservado.';
const pessoa = { nome: 'Ana Souza', telefone: '11900000000', cidade: 'Santo André', aceiteTermos: true };
const formularios = {
  diagnosticInput: (email: string) =>
    diagnosticInput.safeParse({ ...pessoa, email, tipoImovel: 'sobrado', preferenciaContato: 'whatsapp' }),
  applicationInput: (email: string) => applicationInput.safeParse({ ...pessoa, email, area: 'engenheiro' }),
  teamInviteInput: (email: string) => teamInviteInput.safeParse({ nome: 'Ana Souza', email, role: 'admin' }),
};

describe('demo', () => {
  it('a senha das contas de demonstração é a do modelo', () => {
    expect(DEMO_SENHA).toBe('fixable123');
  });

  it('a lista de contas traz nome, e-mail, papel e descrição, sem senha', () => {
    const conta = { nome: 'Ana Souza', email: 'ana.demo@fixable.com.br', role: 'cliente', descricao: 'Sobrado' };
    expect(demoAccountsResponse.parse([{ ...conta, senha: 'x' }])).toEqual([conta]);
    expect(demoAccountsResponse.safeParse([{ ...conta, role: 'visitante' }]).success).toBe(false);
  });

  it('reconhece o domínio da demonstração sem diferenciar maiúsculas', () => {
    expect(isDemoEmail(' Joao.DEMO@Fixable.com.br ')).toBe(true);
    expect(isDemoEmail('joao@fixable.com.br')).toBe(false);
    expect(isDemoEmail('demo@fixable.com.br')).toBe(false);
  });

  it.each(Object.entries(formularios))('%s recusa e-mail do domínio da demonstração', (_nome, validar) => {
    const resultado = validar(' Joao.Demo@Fixable.com.br ');
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues).toEqual([expect.objectContaining({ path: ['email'], message: RESERVADO })]);
    expect(validar('joao@fixable.com.br').success).toBe(true);
  });
});
