import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emailOutbox, users } from '../db/schema/index.ts';
import { createUser, resetDb, testApp, type TestApp } from '../../test/helpers.ts';
import { createAdmin } from './create-admin.ts';

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
    const { userId } = await createAdmin(t.db, t.config, { nome: 'Chefe', email: 'chefe@fixable.com' });
    const [user] = await t.db.select().from(users).where(eq(users.id, userId));
    expect(user).toMatchObject({ role: 'admin', status: 'convidado', nome: 'Chefe', email: 'chefe@fixable.com', passwordHash: null });
    const [queued] = await t.db.select().from(emailOutbox);
    expect(queued).toMatchObject({ to: 'chefe@fixable.com', template: 'convite', status: 'pendente' });
  });

  it('e-mail duplicado lança "Já existe um usuário com este e-mail."', async () => {
    await createUser(t.db, { role: 'cliente', email: 'chefe@fixable.com' });
    await expect(createAdmin(t.db, t.config, { nome: 'Chefe', email: 'chefe@fixable.com' })).rejects.toThrow(
      'Já existe um usuário com este e-mail.',
    );
    expect(await t.db.select().from(emailOutbox)).toHaveLength(0);
  });
});
