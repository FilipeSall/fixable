import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sessions, users } from '../../../src/models/index.ts';
import { createUser, loginAs, resetDb, testApp, type TestApp } from '../../helpers.ts';

const ORIGIN = 'http://localhost:4321';
const SENHA = 'senha1234';

let t: TestApp;

beforeEach(async () => {
  t = await testApp();
  t.app.put('/api/_teste/escrita', (_request, reply) => reply.send({ ok: true }));
  t.app.delete('/api/_teste/escrita', (_request, reply) => reply.send({ ok: true }));
  t.app.get('/api/_teste/admin', { preHandler: [t.app.requireRole('admin')] }, (_request, reply) => reply.send({ ok: true }));
  await t.app.ready();
  await resetDb(t.db);
});
afterEach(async () => {
  await t.close();
});

function login(email: string, senha: string, headers: Record<string, string> = { origin: ORIGIN }) {
  return t.app.inject({ method: 'POST', url: '/api/auth/login', headers, payload: { email, senha } });
}

describe('POST /api/auth/login', () => {
  it('login com credenciais corretas devolve Me e cookie fx_session HttpOnly SameSite=Lax', async () => {
    const user = await createUser(t.db, { role: 'cliente', nome: 'Ana', email: 'ana@fixable.com', senha: SENHA });
    const response = await login('ana@fixable.com', SENHA);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: user.id, nome: 'Ana', email: 'ana@fixable.com', role: 'cliente' });
    const setCookie = String(response.headers['set-cookie']);
    expect(setCookie).toContain('fx_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).not.toContain('Secure');
  });

  it('login normaliza o e-mail', async () => {
    await createUser(t.db, { role: 'cliente', email: 'ana@fixable.com', senha: SENHA });
    const response = await login('  ANA@FIXABLE.COM ', SENHA);
    expect(response.statusCode).toBe(200);
    expect(response.json<{ email: string }>().email).toBe('ana@fixable.com');
  });

  it('senha errada e e-mail inexistente devolvem 401 com a mesma mensagem "E-mail ou senha incorretos."', async () => {
    await createUser(t.db, { role: 'cliente', email: 'ana@fixable.com', senha: SENHA });
    const errada = await login('ana@fixable.com', 'outra1234');
    const inexistente = await login('ninguem@fixable.com', SENHA);
    expect(errada.statusCode).toBe(401);
    expect(inexistente.statusCode).toBe(401);
    expect(errada.json()).toEqual({ error: { code: 'invalid_credentials', message: 'E-mail ou senha incorretos.' } });
    expect(inexistente.json()).toEqual(errada.json());
  });

  it('conta convidada devolve 401 invalid_credentials', async () => {
    await createUser(t.db, { role: 'cliente', status: 'convidado', email: 'conv@fixable.com', senha: SENHA });
    const response = await login('conv@fixable.com', SENHA);
    expect(response.statusCode).toBe(401);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('invalid_credentials');
  });

  it('conta bloqueada com senha correta devolve 403 "Sua conta está bloqueada. Fale com a Fixable."', async () => {
    await createUser(t.db, { role: 'cliente', status: 'bloqueado', email: 'bloq@fixable.com', senha: SENHA });
    const response = await login('bloq@fixable.com', SENHA);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: { code: 'account_blocked', message: 'Sua conta está bloqueada. Fale com a Fixable.' },
    });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('conta bloqueada com senha errada devolve 401', async () => {
    await createUser(t.db, { role: 'cliente', status: 'bloqueado', email: 'bloq@fixable.com', senha: SENHA });
    const response = await login('bloq@fixable.com', 'outra1234');
    expect(response.statusCode).toBe(401);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('invalid_credentials');
  });

  it('senha com mais de 128 caracteres devolve 400', async () => {
    const response = await login('ana@fixable.com', 'a'.repeat(129));
    expect(response.statusCode).toBe(400);
  });

  it('a 11ª tentativa de login em 15 min devolve 429 "Muitas tentativas. Aguarde alguns minutos e tente de novo."', async () => {
    for (let i = 0; i < 10; i++) {
      const response = await login('ninguem@fixable.com', SENHA);
      expect(response.statusCode).toBe(401);
    }
    const response = await login('ninguem@fixable.com', SENHA);
    expect(response.statusCode).toBe(429);
    expect(response.json()).toEqual({
      error: { code: 'rate_limited', message: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' },
    });
  });
});

describe('GET /api/auth/me', () => {
  it('GET /me com cookie devolve o usuário; sem cookie devolve 401', async () => {
    const user = await createUser(t.db, { role: 'admin', nome: 'Bia', email: 'bia@fixable.com', senha: SENHA });
    const cookie = await loginAs(t.app, 'bia@fixable.com', SENHA);
    const ok = await t.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ id: user.id, nome: 'Bia', email: 'bia@fixable.com', role: 'admin' });
    const sem = await t.app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(sem.statusCode).toBe(401);
    expect(sem.json()).toEqual({ error: { code: 'unauthorized', message: 'Faça login para continuar.' } });
  });

  it('bloquear o usuário no banco faz o /me seguinte devolver 401', async () => {
    const user = await createUser(t.db, { role: 'cliente', email: 'ana@fixable.com', senha: SENHA });
    const cookie = await loginAs(t.app, 'ana@fixable.com', SENHA);
    await t.db.update(users).set({ status: 'bloqueado' }).where(eq(users.id, user.id));
    const response = await t.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(response.statusCode).toBe(401);
  });

  it('cookie com token desconhecido devolve 401', async () => {
    const response = await t.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: 'fx_session=token-inventado' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('sessão com expiresAt a menos de 15 dias é renovada para now + 30 dias e o cookie é reenviado', async () => {
    const user = await createUser(t.db, { role: 'cliente', email: 'ana@fixable.com', senha: SENHA });
    const cookie = await loginAs(t.app, 'ana@fixable.com', SENHA);
    const soon = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    await t.db.update(sessions).set({ expiresAt: soon }).where(eq(sessions.userId, user.id));
    const response = await t.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(response.statusCode).toBe(200);
    const [row] = await t.db.select().from(sessions).where(eq(sessions.userId, user.id));
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(row!.expiresAt.getTime() - (Date.now() + thirtyDays))).toBeLessThan(60_000);
    expect(String(response.headers['set-cookie'])).toContain('fx_session=');
  });

  it('sessão com mais de 15 dias restantes não é renovada', async () => {
    const user = await createUser(t.db, { role: 'cliente', email: 'ana@fixable.com', senha: SENHA });
    const cookie = await loginAs(t.app, 'ana@fixable.com', SENHA);
    const [before] = await t.db.select().from(sessions).where(eq(sessions.userId, user.id));
    const response = await t.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    const [after] = await t.db.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(after!.expiresAt.getTime()).toBe(before!.expiresAt.getTime());
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('sessão expirada devolve 401', async () => {
    const user = await createUser(t.db, { role: 'cliente', email: 'ana@fixable.com', senha: SENHA });
    const cookie = await loginAs(t.app, 'ana@fixable.com', SENHA);
    await t.db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.userId, user.id));
    const response = await t.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(response.statusCode).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('logout revoga a sessão: /me com o mesmo cookie devolve 401', async () => {
    await createUser(t.db, { role: 'cliente', email: 'ana@fixable.com', senha: SENHA });
    const cookie = await loginAs(t.app, 'ana@fixable.com', SENHA);
    const out = await t.app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie, origin: ORIGIN },
    });
    expect(out.statusCode).toBe(204);
    expect(String(out.headers['set-cookie'])).toContain('fx_session=;');
    const me = await t.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });

  it('logout sem sessão devolve 204', async () => {
    const out = await t.app.inject({ method: 'POST', url: '/api/auth/logout', headers: { origin: ORIGIN } });
    expect(out.statusCode).toBe(204);
  });
});

describe('origin-check', () => {
  it('POST sem Origin ou com Origin diferente devolve 403', async () => {
    await createUser(t.db, { role: 'cliente', email: 'ana@fixable.com', senha: SENHA });
    const sem = await login('ana@fixable.com', SENHA, {});
    const outra = await login('ana@fixable.com', SENHA, { origin: 'http://evil.example' });
    const expected = { error: { code: 'forbidden', message: 'Você não tem permissão para acessar este recurso.' } };
    expect(sem.statusCode).toBe(403);
    expect(sem.json()).toEqual(expected);
    expect(outra.statusCode).toBe(403);
    expect(outra.json()).toEqual(expected);
  });

  it('caminho com percent-encoding sem Origin também devolve 403', async () => {
    for (const url of ['/%61pi/auth/logout', '/%61%70%69/auth/logout']) {
      const response = await t.app.inject({ method: 'POST', url });
      expect(response.statusCode).toBe(403);
    }
  });

  it('PUT e DELETE sem Origin devolvem 403 e com Origin correto passam', async () => {
    for (const method of ['PUT', 'DELETE'] as const) {
      const sem = await t.app.inject({ method, url: '/api/_teste/escrita' });
      expect(sem.statusCode).toBe(403);
      const com = await t.app.inject({ method, url: '/api/_teste/escrita', headers: { origin: ORIGIN } });
      expect(com.statusCode).toBe(200);
    }
  });

  it('GET não exige Origin', async () => {
    const response = await t.app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
  });
});

describe('requireRole', () => {
  it("requireRole('admin') devolve 403 para cliente e 200 para admin", async () => {
    await createUser(t.db, { role: 'cliente', email: 'cli@fixable.com', senha: SENHA });
    await createUser(t.db, { role: 'admin', email: 'adm@fixable.com', senha: SENHA });
    const cliente = await loginAs(t.app, 'cli@fixable.com', SENHA);
    const admin = await loginAs(t.app, 'adm@fixable.com', SENHA);
    const negado = await t.app.inject({ method: 'GET', url: '/api/_teste/admin', headers: { cookie: cliente } });
    expect(negado.statusCode).toBe(403);
    expect(negado.json()).toEqual({
      error: { code: 'forbidden', message: 'Você não tem permissão para acessar este recurso.' },
    });
    const ok = await t.app.inject({ method: 'GET', url: '/api/_teste/admin', headers: { cookie: admin } });
    expect(ok.statusCode).toBe(200);
    const anonimo = await t.app.inject({ method: 'GET', url: '/api/_teste/admin' });
    expect(anonimo.statusCode).toBe(401);
  });
});

describe('TRUST_PROXY_HOPS', () => {
  it('com TRUST_PROXY_HOPS=1 o rate limit usa o IP do último salto e ignora X-Forwarded-For forjado', async () => {
    const proxied = await testApp({ TRUST_PROXY_HOPS: 1 });
    try {
      await proxied.app.ready();
      const attempt = (fake: string) =>
        proxied.app.inject({
          method: 'POST',
          url: '/api/auth/login',
          headers: { origin: ORIGIN, 'x-forwarded-for': `${fake}, 10.0.0.9` },
          payload: { email: 'ninguem@fixable.com', senha: SENHA },
        });
      for (let i = 0; i < 10; i++) {
        expect((await attempt(`203.0.113.${i + 1}`)).statusCode).toBe(401);
      }
      expect((await attempt('203.0.113.200')).statusCode).toBe(429);
    } finally {
      await proxied.close();
    }
  });
});
