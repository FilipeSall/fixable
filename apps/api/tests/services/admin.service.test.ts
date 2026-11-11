import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emailOutbox, emailTokens, users } from '../../src/models/index.ts';
import { createUser, resetDb, testApp, type TestApp } from '../helpers.ts';
import { sendInvite } from '../../src/services/invite.service.ts';
import { createAdmin } from '../../src/services/admin.service.ts';

let t: TestApp;

beforeEach(async () => {
  t = await testApp();
  await resetDb(t.db);
});
afterEach(async () => {
  await t.close();
});

describe('createAdmin', () => {
  it('cria admin convidado e enfileira convite', async () => {
    const { userId, convite } = await createAdmin(t.db, t.config, { nome: 'Chefe', email: 'chefe@fixable.com' });
    expect(convite).toBe('enviado');
    const [user] = await t.db.select().from(users).where(eq(users.id, userId));
    expect(user).toMatchObject({ role: 'admin', status: 'convidado', nome: 'Chefe', email: 'chefe@fixable.com', passwordHash: null });
    const [queued] = await t.db.select().from(emailOutbox);
    expect(queued).toMatchObject({ to: 'chefe@fixable.com', template: 'convite', status: 'pendente' });
  });

  it.each([
    { role: 'cliente', status: 'ativo' },
    { role: 'cliente', status: 'convidado' },
    { role: 'admin', status: 'ativo' },
    { role: 'admin', status: 'bloqueado' },
  ] as const)('e-mail de $role $status lança "Já existe um usuário com este e-mail."', async ({ role, status }) => {
    await createUser(t.db, { role, status, email: 'chefe@fixable.com' });
    await expect(createAdmin(t.db, t.config, { nome: 'Chefe', email: 'chefe@fixable.com' })).rejects.toThrow(
      'Já existe um usuário com este e-mail.',
    );
    expect(await t.db.select().from(emailOutbox)).toHaveLength(0);
  });

  it('admin ainda convidado recebe um novo convite e o anterior deixa de valer', async () => {
    const existing = await createUser(t.db, { role: 'admin', status: 'convidado', email: 'chefe@fixable.com' });
    await sendInvite(t.db, t.config, existing.id);

    const result = await createAdmin(t.db, t.config, { nome: 'Outro Nome', email: 'chefe@fixable.com' });

    expect(result).toEqual({ userId: existing.id, convite: 'reenviado' });
    const queued = await t.db.select().from(emailOutbox);
    expect(queued.map((row) => row.template)).toEqual(['convite', 'convite']);
    const tokens = await t.db.select().from(emailTokens).where(eq(emailTokens.userId, existing.id));
    expect(tokens.filter((token) => token.usedAt === null)).toHaveLength(1);
    expect(await t.db.select().from(users)).toHaveLength(1);
  });
});
