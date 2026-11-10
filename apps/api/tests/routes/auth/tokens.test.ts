import { and, eq, isNull } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emailOutbox, emailTokens, users } from '../../../src/models/index.ts';
import { createUser, loginAs, resetDb, testApp, tokenFromLink, type TestApp } from '../../helpers.ts';
import { processOutbox } from '../../../src/services/outbox.service.ts';
import { issueEmailToken } from '../../../src/services/email-token.service.ts';
import { sendInvite, sendPasswordReset } from '../../../src/services/invite.service.ts';

const ORIGIN = 'http://localhost:4321';
const SENHA_NOVA = 'novasenha123';
const TOKEN_INVALIDO = { error: { code: 'token_invalid', message: 'Este link expirou ou já foi usado.' } };
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

let t: TestApp;

beforeEach(async () => {
  t = await testApp();
  await t.app.ready();
  await resetDb(t.db);
});
afterEach(async () => {
  await t.close();
});

async function lastLinkToken(template: string): Promise<string> {
  const rows = await t.db.select().from(emailOutbox).where(eq(emailOutbox.template, template));
  return tokenFromLink((rows.at(-1)!.data as { link: string }).link);
}

function accept(token: string, senha: string = SENHA_NOVA) {
  return t.app.inject({
    method: 'POST',
    url: '/api/auth/invite/accept',
    headers: { origin: ORIGIN },
    payload: { token, senha },
  });
}

function reset(token: string, senha: string = SENHA_NOVA) {
  return t.app.inject({
    method: 'POST',
    url: '/api/auth/password/reset',
    headers: { origin: ORIGIN },
    payload: { token, senha },
  });
}

function lookup(token: string) {
  return t.app.inject({
    method: 'POST',
    url: '/api/auth/tokens/lookup',
    headers: { origin: ORIGIN },
    payload: { token },
  });
}

function forgot(email: string) {
  return t.app.inject({
    method: 'POST',
    url: '/api/auth/password/forgot',
    headers: { origin: ORIGIN },
    payload: { email },
  });
}

describe('convite', () => {
  it('sendInvite enfileira e-mail convite cujo link aceita a senha e ativa a conta', async () => {
    const user = await createUser(t.db, { role: 'cliente', status: 'convidado', nome: 'Ana', email: 'ana@fixable.com' });
    await sendInvite(t.db, t.config, user.id);

    const [row] = await t.db.select().from(emailOutbox);
    expect(row!.template).toBe('convite');
    expect(row!.to).toBe('ana@fixable.com');
    expect((row!.data as { link: string }).link).toMatch(/^http:\/\/localhost:4321\/app\/convite#token=[\w-]{43}$/);

    const response = await accept(await lastLinkToken('convite'));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: user.id, nome: 'Ana', email: 'ana@fixable.com', role: 'cliente' });
    expect(String(response.headers['set-cookie'])).toContain('fx_session=');

    const [stored] = await t.db.select().from(users).where(eq(users.id, user.id));
    expect(stored!.status).toBe('ativo');
    expect(stored!.passwordHash).not.toBeNull();
    await loginAs(t.app, 'ana@fixable.com', SENHA_NOVA);
  });

  it('convite usado uma segunda vez devolve 410', async () => {
    const user = await createUser(t.db, { role: 'cliente', status: 'convidado' });
    await sendInvite(t.db, t.config, user.id);
    const token = await lastLinkToken('convite');
    expect((await accept(token)).statusCode).toBe(200);
    const second = await accept(token);
    expect(second.statusCode).toBe(410);
    expect(second.json()).toEqual(TOKEN_INVALIDO);
  });

  it('dois accepts simultâneos com o mesmo token: exatamente um 200 e um 410', async () => {
    const user = await createUser(t.db, { role: 'cliente', status: 'convidado' });
    await sendInvite(t.db, t.config, user.id);
    const token = await lastLinkToken('convite');
    const responses = await Promise.all([accept(token), accept(token)]);
    expect(responses.map((response) => response.statusCode).sort((a, b) => a - b)).toEqual([200, 410]);
  });

  it('convite com 48h + 1min devolve 410', async () => {
    const user = await createUser(t.db, { role: 'cliente', status: 'convidado' });
    const issuedAt = new Date(Date.now() - 48 * HOUR_MS - MINUTE_MS);
    const { token } = await issueEmailToken(t.db, user.id, 'convite', issuedAt);
    const response = await accept(token);
    expect(response.statusCode).toBe(410);
    expect(response.json()).toEqual(TOKEN_INVALIDO);
  });

  it('convite com 47h59 ainda é aceito', async () => {
    const user = await createUser(t.db, { role: 'cliente', status: 'convidado' });
    const issuedAt = new Date(Date.now() - 48 * HOUR_MS + MINUTE_MS);
    const { token } = await issueEmailToken(t.db, user.id, 'convite', issuedAt);
    expect((await accept(token)).statusCode).toBe(200);
  });

  it('novo convite invalida o anterior', async () => {
    const user = await createUser(t.db, { role: 'cliente', status: 'convidado' });
    await sendInvite(t.db, t.config, user.id);
    const first = await lastLinkToken('convite');
    await sendInvite(t.db, t.config, user.id);
    const second = await lastLinkToken('convite');
    expect(second).not.toBe(first);
    expect((await accept(first)).statusCode).toBe(410);
    expect((await accept(second)).statusCode).toBe(200);
  });

  it('guarda apenas o hash SHA-256 do token', async () => {
    const user = await createUser(t.db, { role: 'cliente', status: 'convidado' });
    const { token } = await issueEmailToken(t.db, user.id, 'convite');
    const [stored] = await t.db.select().from(emailTokens).where(eq(emailTokens.userId, user.id));
    expect(stored!.tokenHash).not.toBe(token);
    expect(stored!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('accept com senha "abcdefgh" devolve 400 com fields.senha "Use letras e números na senha."', async () => {
    const user = await createUser(t.db, { role: 'cliente', status: 'convidado' });
    await sendInvite(t.db, t.config, user.id);
    const response = await accept(await lastLinkToken('convite'), 'abcdefgh');
    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { fields: Record<string, string> } }>().error.fields['senha']).toBe('Use letras e números na senha.');
  });

  it('usuário bloqueado: consome o token, não ativa e devolve 403 account_blocked', async () => {
    const user = await createUser(t.db, { role: 'cliente', status: 'bloqueado' });
    await sendInvite(t.db, t.config, user.id);
    const token = await lastLinkToken('convite');
    const response = await accept(token);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: { code: 'account_blocked', message: 'Sua conta está bloqueada. Fale com a Fixable.' },
    });
    expect(response.headers['set-cookie']).toBeUndefined();
    const [stored] = await t.db.select().from(users).where(eq(users.id, user.id));
    expect(stored!.status).toBe('bloqueado');
    expect(stored!.passwordHash).toBeNull();
    expect((await accept(token)).statusCode).toBe(410);
  });

  it('usuário ativo que aceita convite válido só define a senha e entra', async () => {
    const user = await createUser(t.db, { role: 'cliente', status: 'ativo', senha: 'antiga1234' });
    await sendInvite(t.db, t.config, user.id);
    const response = await accept(await lastLinkToken('convite'));
    expect(response.statusCode).toBe(200);
    const [stored] = await t.db.select().from(users).where(eq(users.id, user.id));
    expect(stored!.status).toBe('ativo');
    await loginAs(t.app, user.email, SENHA_NOVA);
  });
});

describe('POST /api/auth/tokens/lookup', () => {
  it('devolve purpose, nome e email; token desconhecido devolve 410', async () => {
    const user = await createUser(t.db, { role: 'cliente', status: 'convidado', nome: 'Ana', email: 'ana@fixable.com' });
    await sendInvite(t.db, t.config, user.id);
    const token = await lastLinkToken('convite');

    const ok = await lookup(token);
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ purpose: 'convite', nome: 'Ana', email: 'ana@fixable.com' });

    const unknown = await lookup('desconhecido');
    expect(unknown.statusCode).toBe(410);
    expect(unknown.json()).toEqual(TOKEN_INVALIDO);
  });

  it('token já usado devolve 410', async () => {
    const user = await createUser(t.db, { role: 'cliente', status: 'convidado' });
    await sendInvite(t.db, t.config, user.id);
    const token = await lastLinkToken('convite');
    await accept(token);
    const response = await lookup(token);
    expect(response.statusCode).toBe(410);
  });

  it('corpo sem token devolve 400', async () => {
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/auth/tokens/lookup',
      headers: { origin: ORIGIN },
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });

  it('o GET antigo com o token no caminho não existe mais', async () => {
    const user = await createUser(t.db, { role: 'cliente', status: 'convidado' });
    await sendInvite(t.db, t.config, user.id);
    const response = await t.app.inject({ method: 'GET', url: `/api/auth/tokens/${await lastLinkToken('convite')}` });
    expect(response.statusCode).toBe(404);
  });
});

describe('redefinição de senha', () => {
  it('forgot de e-mail inexistente devolve 204 e não enfileira nada', async () => {
    const response = await forgot('ninguem@fixable.com');
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(await t.db.select().from(emailOutbox)).toHaveLength(0);
  });

  it('forgot de usuário bloqueado devolve 204 e não enfileira nada', async () => {
    await createUser(t.db, { role: 'cliente', status: 'bloqueado', email: 'b@fixable.com' });
    expect((await forgot('b@fixable.com')).statusCode).toBe(204);
    expect(await t.db.select().from(emailOutbox)).toHaveLength(0);
  });

  it('forgot de usuário convidado reenvia o convite e invalida o anterior', async () => {
    const user = await createUser(t.db, { role: 'cliente', status: 'convidado', email: 'a@fixable.com' });
    await sendInvite(t.db, t.config, user.id);
    const previous = await lastLinkToken('convite');

    expect((await forgot('A@Fixable.com')).statusCode).toBe(204);

    const queued = await t.db.select().from(emailOutbox);
    expect(queued.map((row) => row.template)).toEqual(['convite', 'convite']);
    expect((queued[1]!.data as { link: string }).link).toMatch(/^http:\/\/localhost:4321\/app\/convite#token=/);
    expect((await accept(previous)).statusCode).toBe(410);
    expect((await accept(await lastLinkToken('convite'))).statusCode).toBe(200);
  });

  it('forgot trata e-mail com maiúsculas e espaços como o mesmo usuário', async () => {
    await createUser(t.db, { role: 'cliente', email: 'ana@fixable.com', senha: 'antiga1234' });
    expect((await forgot('  Ana@Fixable.com ')).statusCode).toBe(204);
    expect(await t.db.select().from(emailOutbox)).toHaveLength(1);
  });

  it('forgot de usuário ativo devolve 204 e enfileira redefinicao mesmo com o mailer falhando', async () => {
    await createUser(t.db, { role: 'cliente', nome: 'Ana', email: 'ana@fixable.com', senha: 'antiga1234' });
    t.mailer.failNext(1);
    const response = await forgot('ana@fixable.com');
    expect(response.statusCode).toBe(204);

    const [queued] = await t.db.select().from(emailOutbox);
    expect(queued!.template).toBe('redefinicao');
    expect((queued!.data as { link: string }).link).toMatch(/^http:\/\/localhost:4321\/app\/redefinir-senha#token=[\w-]{43}$/);

    expect(await processOutbox(t.db, t.mailer)).toEqual({ sent: 0, failed: 1 });
    expect(await processOutbox(t.db, t.mailer, () => new Date(Date.now() + 10 * MINUTE_MS))).toEqual({ sent: 1, failed: 0 });
    expect(t.mailer.sent).toHaveLength(1);
  });

  it('dois pedidos antes do processamento entregam só o link mais recente', async () => {
    await createUser(t.db, { role: 'cliente', email: 'ana@fixable.com', senha: 'antiga1234' });
    await forgot('ana@fixable.com');
    await forgot('ana@fixable.com');
    const latest = await lastLinkToken('redefinicao');

    expect(await processOutbox(t.db, t.mailer)).toEqual({ sent: 1, failed: 0 });

    expect(t.mailer.sent).toHaveLength(1);
    expect(t.mailer.sent[0]!.text).toContain(latest);
    const rows = await t.db.select().from(emailOutbox).orderBy(emailOutbox.createdAt);
    expect(rows.map((row) => row.status)).toEqual(['descartado', 'enviado']);
    expect(rows[0]!.data).not.toHaveProperty('link');
  });

  it('pedidos simultâneos deixam um único link válido', async () => {
    const user = await createUser(t.db, { role: 'cliente', senha: 'antiga1234' });
    await Promise.all(Array.from({ length: 5 }, () => sendPasswordReset(t.db, t.config, user.id)));
    const open = await t.db
      .select()
      .from(emailTokens)
      .where(and(eq(emailTokens.userId, user.id), eq(emailTokens.purpose, 'redefinicao'), isNull(emailTokens.usedAt)));
    expect(open).toHaveLength(1);
  });

  it('a 6ª solicitação de forgot em 1h devolve 429', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      statuses.push((await forgot('ninguem@fixable.com')).statusCode);
    }
    expect(statuses).toEqual([204, 204, 204, 204, 204, 429]);
  });

  it('reset troca a senha e derruba todas as sessões', async () => {
    const user = await createUser(t.db, { role: 'cliente', email: 'ana@fixable.com', senha: 'antiga1234' });
    const cookieA = await loginAs(t.app, 'ana@fixable.com', 'antiga1234');
    const cookieB = await loginAs(t.app, 'ana@fixable.com', 'antiga1234');
    await sendPasswordReset(t.db, t.config, user.id);

    const response = await reset(await lastLinkToken('redefinicao'));
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    for (const cookie of [cookieA, cookieB]) {
      const me = await t.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
      expect(me.statusCode).toBe(401);
    }
    await loginAs(t.app, 'ana@fixable.com', SENHA_NOVA);
    const old = await t.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin: ORIGIN },
      payload: { email: 'ana@fixable.com', senha: 'antiga1234' },
    });
    expect(old.statusCode).toBe(401);
  });

  it('reset usado duas vezes devolve 410 e token de convite não serve para reset', async () => {
    const user = await createUser(t.db, { role: 'cliente', senha: 'antiga1234' });
    await sendPasswordReset(t.db, t.config, user.id);
    const token = await lastLinkToken('redefinicao');
    expect((await reset(token)).statusCode).toBe(204);
    expect((await reset(token)).statusCode).toBe(410);

    await sendInvite(t.db, t.config, user.id);
    expect((await reset(await lastLinkToken('convite'))).statusCode).toBe(410);
  });

  it('redefinição com 1h + 1min devolve 410', async () => {
    const user = await createUser(t.db, { role: 'cliente', senha: 'antiga1234' });
    const { token } = await issueEmailToken(t.db, user.id, 'redefinicao', new Date(Date.now() - HOUR_MS - MINUTE_MS));
    const response = await reset(token);
    expect(response.statusCode).toBe(410);
    expect(response.json()).toEqual(TOKEN_INVALIDO);
  });

  it('novo pedido invalida o link anterior do mesmo propósito sem afetar outro propósito', async () => {
    const user = await createUser(t.db, { role: 'cliente', senha: 'antiga1234' });
    const { token: invite } = await issueEmailToken(t.db, user.id, 'convite');
    await issueEmailToken(t.db, user.id, 'redefinicao');
    await issueEmailToken(t.db, user.id, 'redefinicao');
    const rows = await t.db
      .select()
      .from(emailTokens)
      .where(and(eq(emailTokens.userId, user.id), eq(emailTokens.purpose, 'redefinicao')));
    expect(rows.filter((row) => row.usedAt === null)).toHaveLength(1);
    expect((await lookup(invite)).statusCode).toBe(200);
  });
});
