import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emailOutbox, sessions, users } from '../../src/models/index.ts';
import { issueLoginSession, resetPassword, verifyLoginCredentials } from '../../src/services/auth.service.ts';
import { sendPasswordReset } from '../../src/services/invite.service.ts';
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
