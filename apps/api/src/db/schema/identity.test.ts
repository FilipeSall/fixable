import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { emailTokens, sessions, users } from './index.ts';
import { resetDb, testApp, type TestApp } from '../../../test/helpers.ts';

let ctx: TestApp;

beforeAll(async () => {
  ctx = await testApp();
});

beforeEach(async () => {
  await resetDb(ctx.db);
});

afterAll(async () => {
  await ctx.close();
});

const future = () => new Date(Date.now() + 60_000);

describe('schema de identidade', () => {
  it('rejeita dois usuários com o mesmo e-mail', async () => {
    await ctx.db.insert(users).values({ role: 'cliente', nome: 'Ana', email: 'ana@fixable.com' });
    await expect(
      ctx.db.insert(users).values({ role: 'cliente', nome: 'Outra', email: 'ana@fixable.com' }),
    ).rejects.toThrow();
  });

  it('remover usuário remove sessões e tokens de e-mail', async () => {
    const [user] = await ctx.db
      .insert(users)
      .values({ role: 'cliente', nome: 'Ana', email: 'ana@fixable.com' })
      .returning();
    await ctx.db.insert(sessions).values({ userId: user!.id, tokenHash: 'a', expiresAt: future() });
    await ctx.db
      .insert(emailTokens)
      .values({ userId: user!.id, purpose: 'convite', tokenHash: 'b', expiresAt: future() });

    await ctx.db.delete(users).where(eq(users.id, user!.id));

    expect(await ctx.db.select().from(sessions)).toHaveLength(0);
    expect(await ctx.db.select().from(emailTokens)).toHaveLength(0);
  });

  it('usuário novo nasce convidado', async () => {
    const [user] = await ctx.db
      .insert(users)
      .values({ role: 'profissional', nome: 'Beto', email: 'beto@fixable.com' })
      .returning();
    expect(user!.status).toBe('convidado');
  });

  it.each(['Ana@X.com', ' ana@x.com', 'ana@x.com '])('rejeita e-mail não normalizado %j direto no banco', async (email) => {
    await expect(ctx.db.insert(users).values({ role: 'cliente', nome: 'Ana', email })).rejects.toThrow();
    expect(await ctx.db.select().from(users)).toHaveLength(0);
  });

  it('atualizar o usuário renova updatedAt automaticamente', async () => {
    const past = new Date('2026-01-01T00:00:00Z');
    const [user] = await ctx.db
      .insert(users)
      .values({ role: 'cliente', nome: 'Ana', email: 'ana@fixable.com', updatedAt: past })
      .returning();
    const [updated] = await ctx.db.update(users).set({ nome: 'Ana Souza' }).where(eq(users.id, user!.id)).returning();
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(past.getTime());
  });
});
