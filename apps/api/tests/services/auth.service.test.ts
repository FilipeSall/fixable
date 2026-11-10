import { setTimeout as sleep } from 'node:timers/promises';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emailOutbox, emailTokens, sessions, users } from '../../src/models/index.ts';
import {
  acceptInvite,
  issueLoginSession,
  resetPassword,
  verifyLoginCredentials,
} from '../../src/services/auth.service.ts';
import type { EmailTokenPurpose } from '../../src/services/email-token.service.ts';
import { sendInvite, sendPasswordReset } from '../../src/services/invite.service.ts';
import { revokeUserSessions } from '../../src/services/session.service.ts';
import { hashPassword } from '../../src/utils/password.ts';
import { hashToken } from '../../src/utils/token.ts';
import { createUser, resetDb, testApp, type TestApp } from '../helpers.ts';

const SENHA_ANTIGA = 'antiga1234';
const SENHA_NOVA = 'novasenha123';

let t: TestApp;

beforeEach(async () => {
  t = await testApp();
  await t.app.ready();
  await resetDb(t.db);
});
afterEach(async () => {
  await t.close();
});

async function lastResetToken(): Promise<string> {
  const rows = await t.db.select().from(emailOutbox).where(eq(emailOutbox.template, 'redefinicao'));
  return new URL((rows.at(-1)!.data as { link: string }).link).searchParams.get('token')!;
}

describe('login concorrente com redefinição de senha', () => {
  it('senha antiga verificada antes de um reset completo não gera sessão', async () => {
    const user = await createUser(t.db, { role: 'cliente', email: 'ana@fixable.com', senha: SENHA_ANTIGA });
    const verified = await verifyLoginCredentials(t.db, { email: 'ana@fixable.com', senha: SENHA_ANTIGA });

    await sendPasswordReset(t.db, t.config, user.id);
    await resetPassword(t.db, { token: await lastResetToken(), senha: SENHA_NOVA });

    await expect(issueLoginSession(t.db, verified, undefined)).rejects.toMatchObject({
      statusCode: 401,
      code: 'invalid_credentials',
    });
    expect(await t.db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
  });

  it('reset em andamento com o usuário travado: o login espera o commit e devolve 401 sem sessão', async () => {
    const user = await createUser(t.db, { role: 'cliente', email: 'ana@fixable.com', senha: SENHA_ANTIGA });
    const verified = await verifyLoginCredentials(t.db, { email: 'ana@fixable.com', senha: SENHA_ANTIGA });
    const novoHash = await hashPassword(SENHA_NOVA);

    let issuing: Promise<unknown> = Promise.resolve();
    await t.db.transaction(async (tx) => {
      await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for('update');
      await tx.update(users).set({ passwordHash: novoHash, updatedAt: new Date() }).where(eq(users.id, user.id));
      await revokeUserSessions(tx, user.id);
      issuing = issueLoginSession(t.db, verified, undefined);
      issuing.catch(() => undefined);
      await waitForLockWait();
    });

    await expect(issuing).rejects.toMatchObject({ statusCode: 401, code: 'invalid_credentials' });
    expect(await t.db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
  });

  it('conta bloqueada entre a verificação e a emissão devolve 403 sem sessão', async () => {
    const user = await createUser(t.db, { role: 'cliente', email: 'ana@fixable.com', senha: SENHA_ANTIGA });
    const verified = await verifyLoginCredentials(t.db, { email: 'ana@fixable.com', senha: SENHA_ANTIGA });

    await t.db.update(users).set({ status: 'bloqueado' }).where(eq(users.id, user.id));

    await expect(issueLoginSession(t.db, verified, undefined)).rejects.toMatchObject({
      statusCode: 403,
      code: 'account_blocked',
    });
    expect(await t.db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
  });
});

async function waitForLockWait(): Promise<void> {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const [row] = await t.db.execute<{ waiting: number }>(
      sql`SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    );
    if (row!.waiting > 0) return;
    await sleep(10);
  }
  throw new Error('nenhuma transação ficou esperando lock');
}

async function lastToken(template: EmailTokenPurpose): Promise<string> {
  const rows = await t.db.select().from(emailOutbox).where(eq(emailOutbox.template, template));
  return new URL((rows.at(-1)!.data as { link: string }).link).searchParams.get('token')!;
}

describe('consumo de token concorrente com reemissão para a mesma conta', () => {
  it.each([
    { purpose: 'redefinicao' as const, status: 'ativo' as const, send: sendPasswordReset, consume: resetPassword },
    { purpose: 'convite' as const, status: 'convidado' as const, send: sendInvite, consume: acceptInvite },
  ])('$purpose: reemissão com o usuário travado não entra em deadlock e invalida o link antigo', async (scenario) => {
    const user = await createUser(t.db, { role: 'cliente', status: scenario.status, senha: SENHA_ANTIGA });
    await scenario.send(t.db, t.config, user.id);
    const oldToken = await lastToken(scenario.purpose);

    let consuming: Promise<unknown> | undefined;
    const reissue = t.db.transaction(async (tx) => {
      await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for('update');
      consuming = scenario.consume(t.db, { token: oldToken, senha: SENHA_NOVA });
      consuming.catch(() => undefined);
      await waitForLockWait();
      await scenario.send(tx, t.config, user.id);
    });

    const [reissued, consumed] = await Promise.allSettled([reissue, reissue.then(() => consuming)]);
    expect(reissued).toEqual({ status: 'fulfilled', value: undefined });
    expect(consumed.status).toBe('rejected');
    expect((consumed as PromiseRejectedResult).reason).toMatchObject({ statusCode: 410, code: 'token_invalid' });

    const open = await t.db
      .select()
      .from(emailTokens)
      .where(and(eq(emailTokens.userId, user.id), eq(emailTokens.purpose, scenario.purpose), isNull(emailTokens.usedAt)));
    expect(open).toHaveLength(1);
    expect(open[0]!.tokenHash).toBe(hashToken(await lastToken(scenario.purpose)));
    expect(await t.db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
  });
});
