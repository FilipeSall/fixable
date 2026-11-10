import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { clients } from '../../src/models/index.ts';
import { createUser, resetDb, testApp, type TestApp } from '../helpers.ts';
import { pickEngineer } from '../../src/services/assignment.service.ts';

let ctx: TestApp;

async function addClients(engineerId: string, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    const user = await createUser(ctx.db, { role: 'cliente' });
    await ctx.db.insert(clients).values({ userId: user.id, engineerId });
  }
}

describe('pickEngineer', () => {
  beforeEach(async () => {
    ctx ??= await testApp();
    await resetDb(ctx.db);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('devolve null sem engenheiro ativo', async () => {
    await createUser(ctx.db, { role: 'engenheiro', status: 'convidado' });
    await createUser(ctx.db, { role: 'engenheiro', status: 'bloqueado' });
    expect(await pickEngineer(ctx.db)).toBeNull();
  });

  it('escolhe o de menor carga', async () => {
    const a = await createUser(ctx.db, { role: 'engenheiro', nome: 'A' });
    const b = await createUser(ctx.db, { role: 'engenheiro', nome: 'B' });
    await addClients(a.id, 2);
    await addClients(b.id, 1);
    expect(await pickEngineer(ctx.db)).toEqual({ id: b.id, nome: 'B' });
  });

  it('desempata pelo mais antigo', async () => {
    const antigo = await createUser(ctx.db, { role: 'engenheiro', nome: 'Antigo' });
    await createUser(ctx.db, { role: 'engenheiro', nome: 'Novo' });
    expect(await pickEngineer(ctx.db)).toEqual({ id: antigo.id, nome: 'Antigo' });
  });
});
