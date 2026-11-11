import { afterEach, describe, expect, it } from 'vitest';
import { DEMO_SENHA } from '@fixable/shared';
import { seedDemo } from '../../../src/services/demo-seed.service.ts';
import { createUser, loginAs, resetDb, testApp, type TestApp } from '../../helpers.ts';

const ORIGIN = 'http://localhost:4321';
const RAFAEL = 'rafael.demo@fixable.com.br';
const opened: TestApp[] = [];

async function start(demoMode: boolean, reset = true): Promise<TestApp> {
  const app = await testApp({ DEMO_MODE: demoMode });
  opened.push(app);
  if (reset) await resetDb(app.db);
  return app;
}

function login(app: TestApp, email: string, senha: string) {
  return app.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { origin: ORIGIN },
    payload: { email, senha },
  });
}

describe('contas de demonstração e DEMO_MODE', () => {
  afterEach(async () => {
    await Promise.all(opened.splice(0).map((app) => app.close()));
  });

  it('com DEMO_MODE ligado a conta demo entra com a senha conhecida', async () => {
    const app = await start(true);
    await seedDemo(app.db, { DEMO_MODE: true });
    const response = await login(app, RAFAEL, DEMO_SENHA);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ email: RAFAEL, role: 'engenheiro' });
  });

  it('com DEMO_MODE desligado a conta demo não entra, mas as contas reais sim', async () => {
    const app = await start(false);
    await seedDemo(app.db, { DEMO_MODE: true });
    await createUser(app.db, { role: 'engenheiro', email: 'real@fixable.com', senha: 'senha1234' });
    const demo = await login(app, RAFAEL, DEMO_SENHA);
    expect(demo.statusCode).toBe(401);
    expect(demo.json()).toEqual({ error: { code: 'invalid_credentials', message: 'E-mail ou senha incorretos.' } });
    expect((await login(app, 'real@fixable.com', 'senha1234')).statusCode).toBe(200);
  });

  it('a sessão aberta no modo demo deixa de valer quando DEMO_MODE é desligado', async () => {
    const ligado = await start(true);
    await seedDemo(ligado.db, { DEMO_MODE: true });
    const cookie = await loginAs(ligado.app, RAFAEL, DEMO_SENHA);
    const me = () => ({ method: 'GET' as const, url: '/api/auth/me', headers: { cookie } });
    expect((await ligado.app.inject(me())).statusCode).toBe(200);

    const desligado = await start(false, false);
    expect((await desligado.app.inject(me())).statusCode).toBe(401);
  });
});
