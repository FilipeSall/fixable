import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUser, resetDb, testApp, type TestApp } from '../../helpers.ts';
import { emailOutbox } from '../../../src/models/index.ts';
import { sendInvite } from '../../../src/services/invite.service.ts';

const hashCalls = vi.hoisted(() => ({ count: 0 }));

vi.mock('../../../src/utils/password.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/utils/password.ts')>();
  return {
    ...original,
    hashPassword: (senha: string) => {
      hashCalls.count += 1;
      return original.hashPassword(senha);
    },
  };
});

const ORIGIN = 'http://localhost:4321';
let t: TestApp;

beforeEach(async () => {
  t = await testApp();
  await t.app.ready();
  await resetDb(t.db);
  hashCalls.count = 0;
});
afterEach(async () => {
  await t.close();
});

function post(url: string, token: string) {
  return t.app.inject({ method: 'POST', url, headers: { origin: ORIGIN }, payload: { token, senha: 'novasenha123' } });
}

describe('proteção dos endpoints de token', () => {
  it('token desconhecido em accept e reset devolve 410 sem calcular argon2', async () => {
    const accept = await post('/api/auth/invite/accept', 'inexistente');
    const reset = await post('/api/auth/password/reset', 'inexistente');
    expect(accept.statusCode).toBe(410);
    expect(reset.statusCode).toBe(410);
    expect(hashCalls.count).toBe(0);
  });

  it('token de outro propósito devolve 410 sem calcular argon2', async () => {
    const user = await createUser(t.db, { role: 'cliente', status: 'convidado' });
    await sendInvite(t.db, t.config, user.id);
    const [row] = await t.db.select().from(emailOutbox);
    const token = new URL((row!.data as { link: string }).link).searchParams.get('token')!;
    expect((await post('/api/auth/password/reset', token)).statusCode).toBe(410);
    expect(hashCalls.count).toBe(0);
    expect((await post('/api/auth/invite/accept', token)).statusCode).toBe(200);
    expect(hashCalls.count).toBe(1);
  });

  it.each(['/api/auth/invite/accept', '/api/auth/password/reset', '/api/auth/tokens/lookup'])('a 21ª requisição em 15 min em %s devolve 429', async (url) => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 21; attempt += 1) statuses.push((await post(url, 'inexistente')).statusCode);
    expect(statuses.slice(0, 20).every((status) => status === 410)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});
