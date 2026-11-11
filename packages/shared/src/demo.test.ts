import { describe, expect, it } from 'vitest';
import { DEMO_SENHA, demoAccountsResponse } from './demo.ts';

describe('demo', () => {
  it('a senha das contas de demonstração é a do modelo', () => {
    expect(DEMO_SENHA).toBe('fixable123');
  });

  it('a lista de contas traz nome, e-mail, papel e descrição, sem senha', () => {
    const conta = { nome: 'Ana Souza', email: 'ana.demo@fixable.com.br', role: 'cliente', descricao: 'Sobrado' };
    expect(demoAccountsResponse.parse([{ ...conta, senha: 'x' }])).toEqual([conta]);
    expect(demoAccountsResponse.safeParse([{ ...conta, role: 'visitante' }]).success).toBe(false);
  });
});
