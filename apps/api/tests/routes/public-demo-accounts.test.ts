import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { demoAccountsResponse } from '@fixable/shared';
import { users } from '../../src/models/index.ts';
import { seedDemo } from '../../src/services/demo-seed.service.ts';
import { resetDb, testApp, type TestApp } from '../helpers.ts';

let ctx: TestApp | undefined;

async function start(demoMode: boolean): Promise<TestApp> {
  ctx = await testApp({ DEMO_MODE: demoMode });
  await resetDb(ctx.db);
  return ctx;
}

const listar = (app: TestApp) => app.app.inject({ method: 'GET', url: '/api/public/demo-accounts' });

describe('GET /api/public/demo-accounts', () => {
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined;
  });

  it('responde 404 com DEMO_MODE desligado, mesmo havendo contas demo no banco', async () => {
    const app = await start(false);
    await seedDemo(app.db, { DEMO_MODE: true });
    const response = await listar(app);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'not_found' } });
  });

  it('com DEMO_MODE ligado e sem seed devolve lista vazia', async () => {
    const app = await start(true);
    const response = await listar(app);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('lista as contas demo ativas na ordem admin, engenheiro e clientes, sem senha', async () => {
    const app = await start(true);
    await seedDemo(app.db, { DEMO_MODE: true });
    const response = await listar(app);
    expect(response.statusCode).toBe(200);
    const contas = demoAccountsResponse.parse(response.json());
    expect(contas.map((conta) => [conta.role, conta.email])).toEqual([
      ['admin', 'admin.demo@fixable.com.br'],
      ['engenheiro', 'rafael.demo@fixable.com.br'],
      ['cliente', 'ana.demo@fixable.com.br'],
      ['cliente', 'carlos.demo@fixable.com.br'],
      ['cliente', 'juliana.demo@fixable.com.br'],
    ]);
    expect(contas[1]).toMatchObject({ nome: 'Rafael Lima' });
    expect(contas.every((conta) => conta.descricao.length > 0)).toBe(true);
    expect(response.body).not.toMatch(/senha|password|fixable123|argon2/i);
  });

  it('esconde conta demo que não está ativa', async () => {
    const app = await start(true);
    await seedDemo(app.db, { DEMO_MODE: true });
    await app.db.update(users).set({ status: 'bloqueado' }).where(eq(users.email, 'carlos.demo@fixable.com.br'));
    const emails = (await listar(app)).json<{ email: string }[]>().map((conta) => conta.email);
    expect(emails).not.toContain('carlos.demo@fixable.com.br');
    expect(emails).toHaveLength(4);
  });
});
