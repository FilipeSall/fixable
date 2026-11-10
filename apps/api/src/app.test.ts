import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { emailSchema } from '@fixable/shared';
import { z } from 'zod';
import { loadConfig } from './config.ts';
import { resetDb, testApp, type TestApp } from '../test/helpers.ts';

let ctx: TestApp;

beforeAll(async () => {
  ctx = await testApp();
  ctx.app.post('/api/_test/validate', (request) => z.object({ email: emailSchema }).parse(request.body));
  ctx.app.get('/api/_test/boom', () => {
    throw new Error('segredo');
  });
  await ctx.app.ready();
  await resetDb(ctx.db);
});

afterAll(async () => {
  await ctx.close();
});

describe('GET /api/health', () => {
  it('responde 200 com banco ok', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', db: 'ok' });
  });
});

describe('erros padronizados', () => {
  it('ZodError vira 400 validation com fields por caminho', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/_test/validate',
      headers: { origin: ctx.config.APP_ORIGIN },
      payload: { email: 'x' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: { code: string; fields: Record<string, string> } }>();
    expect(body.error.code).toBe('validation');
    expect(body.error.fields['email']).toBe('Informe um e-mail válido.');
  });

  it('erro desconhecido vira 500 internal sem vazar detalhes', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/_test/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: { code: 'internal', message: 'Algo deu errado. Tente de novo.' } });
  });
});

describe('loadConfig', () => {
  it('lança erro citando DATABASE_URL quando faltar', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });
});
