import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { emailSchema } from '@fixable/shared';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { resetDb, testApp, type TestApp } from './helpers.ts';

let ctx: TestApp;

beforeAll(async () => {
  ctx = await testApp();
  ctx.app.withTypeProvider<ZodTypeProvider>().post(
    '/api/_test/validate',
    {
      schema: {
        body: z.object({
          email: emailSchema,
          apelido: z.string().min(1).optional(),
          endereco: z.object({ cidade: z.string().min(1, 'Informe a cidade.') }).optional(),
        }),
      },
    },
    () => ({ ok: true }),
  );
  ctx.app.post('/api/_test/thrown', (request) => z.object({ email: emailSchema }).parse(request.body));
  ctx.app.get('/api/_test/boom', () => {
    throw new Error('segredo');
  });
  ctx.app.get('/api/_test/forbidden', () => {
    throw Object.assign(new Error('negado'), { statusCode: 403 });
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
  it('erro de validação do type provider vira 400 validation com fields', async () => {
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

  it('fields usa o caminho com pontos', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/_test/validate',
      headers: { origin: ctx.config.APP_ORIGIN },
      payload: { email: 'a@b.com', endereco: { cidade: '' } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: { fields: Record<string, string> } }>().error.fields['endereco.cidade']).toBe('Informe a cidade.');
  });

  it('mensagens padrão do zod em fields saem em português', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/_test/validate',
      headers: { origin: ctx.config.APP_ORIGIN },
      payload: { email: 'a@b.com', apelido: '' },
    });
    expect(res.statusCode).toBe(400);
    const message = res.json<{ error: { fields: Record<string, string> } }>().error.fields['apelido'];
    expect(message).not.toContain('Too small');
    expect(message).toMatch(/pequeno demais/i);
  });

  it('ZodError lançado vira 400 validation com fields', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/_test/thrown',
      headers: { origin: ctx.config.APP_ORIGIN },
      payload: { email: 'x' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: { code: string; fields: Record<string, string> } }>();
    expect(body.error.code).toBe('validation');
    expect(body.error.fields['email']).toBe('Informe um e-mail válido.');
  });

  it('JSON malformado vira 400 validation, não 500', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/_test/validate',
      headers: { origin: ctx.config.APP_ORIGIN, 'content-type': 'application/json' },
      payload: '{"email":',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: { code: string } }>().error.code).toBe('validation');
  });

  it('rota inexistente vira 404 not_found no formato padrão', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/nao-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'not_found', message: 'Recurso não encontrado.' } });
  });

  it('403 genérico usa a mesma mensagem de permissão das demais rotas', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/_test/forbidden' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({
      error: { code: 'forbidden', message: 'Você não tem permissão para acessar este recurso.' },
    });
  });

  it('erro desconhecido vira 500 internal sem vazar detalhes', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/_test/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: { code: 'internal', message: 'Algo deu errado. Tente de novo.' } });
  });
});
