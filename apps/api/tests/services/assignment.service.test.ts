import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { diagnosticInput } from '@fixable/shared';
import { eq } from 'drizzle-orm';
import { clients, users } from '../../src/models/index.ts';
import { createUser, resetDb, testApp, type TestApp } from '../helpers.ts';
import { pickEngineer } from '../../src/services/assignment.service.ts';
import { submitDiagnostic } from '../../src/services/diagnostic.service.ts';

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
    expect(await ctx.db.transaction(pickEngineer)).toBeNull();
  });

  it('ignora engenheiros de demonstração, mesmo sem clientes', async () => {
    const real = await createUser(ctx.db, { role: 'engenheiro', nome: 'Real' });
    const demo = await createUser(ctx.db, { role: 'engenheiro', nome: 'Demo' });
    await ctx.db.update(users).set({ isDemo: true }).where(eq(users.id, demo.id));
    await addClients(real.id, 3);
    expect(await ctx.db.transaction(pickEngineer)).toEqual({ id: real.id, nome: 'Real' });
  });

  it('devolve null quando só há engenheiro de demonstração', async () => {
    const demo = await createUser(ctx.db, { role: 'engenheiro', nome: 'Demo' });
    await ctx.db.update(users).set({ isDemo: true }).where(eq(users.id, demo.id));
    expect(await ctx.db.transaction(pickEngineer)).toBeNull();
  });

  it('escolhe o de menor carga', async () => {
    const a = await createUser(ctx.db, { role: 'engenheiro', nome: 'A' });
    const b = await createUser(ctx.db, { role: 'engenheiro', nome: 'B' });
    await addClients(a.id, 2);
    await addClients(b.id, 1);
    expect(await ctx.db.transaction(pickEngineer)).toEqual({ id: b.id, nome: 'B' });
  });

  it('desempata pelo mais antigo', async () => {
    const antigo = await createUser(ctx.db, { role: 'engenheiro', nome: 'Antigo' });
    await createUser(ctx.db, { role: 'engenheiro', nome: 'Novo' });
    expect(await ctx.db.transaction(pickEngineer)).toEqual({ id: antigo.id, nome: 'Antigo' });
  });

  it('diagnósticos simultâneos de e-mails diferentes dividem os engenheiros empatados', async () => {
    const a = await createUser(ctx.db, { role: 'engenheiro', nome: 'A' });
    const b = await createUser(ctx.db, { role: 'engenheiro', nome: 'B' });

    await Promise.all(
      ['ana@ex.com', 'bia@ex.com'].map((email) => submitDiagnostic(ctx.db, ctx.config, diagnostico(email))),
    );

    const engineerIds = (await ctx.db.select({ engineerId: clients.engineerId }).from(clients)).map(
      (row) => row.engineerId,
    );
    expect(engineerIds).toHaveLength(2);
    expect(new Set(engineerIds)).toEqual(new Set([a.id, b.id]));
  });
});

function diagnostico(email: string) {
  return diagnosticInput.parse({
    nome: 'Cliente Novo',
    email,
    telefone: '(11) 90000-0000',
    cidade: 'Santo André',
    tipoImovel: 'sobrado',
    preferenciaContato: 'whatsapp',
    aceiteTermos: true,
  });
}
