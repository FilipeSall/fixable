import { describe, expect, it } from 'vitest';
import { adminApplicationsQuery, adminLeadsQuery, teamInviteResult } from './admin.ts';
import { ERROR_CODES } from './errors.ts';

describe('admin', () => {
  it('o filtro de leads assume "todos" e aceita "sem"', () => {
    expect(adminLeadsQuery.parse({})).toEqual({ atribuicao: 'todos' });
    expect(adminLeadsQuery.parse({ atribuicao: 'sem' })).toEqual({ atribuicao: 'sem' });
    expect(adminLeadsQuery.safeParse({ atribuicao: 'outro' }).success).toBe(false);
  });

  it('o filtro de candidaturas é opcional e só aceita os status do modelo', () => {
    expect(adminApplicationsQuery.parse({})).toEqual({});
    expect(adminApplicationsQuery.parse({ status: 'pendente' })).toEqual({ status: 'pendente' });
    expect(adminApplicationsQuery.safeParse({ status: 'aberta' }).success).toBe(false);
  });

  it('o resultado do convite diz se foi enviado ou reenviado', () => {
    expect(teamInviteResult.safeParse({ userId: 'u1', convite: 'reenviado' }).success).toBe(true);
    expect(teamInviteResult.safeParse({ userId: 'u1', convite: 'outro' }).success).toBe(false);
  });

  it('a API tem o código conflict para o 409', () => {
    expect(ERROR_CODES).toContain('conflict');
  });
});
