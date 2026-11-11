import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Role } from '@fixable/shared';
import {
  loadClientScope,
  requireClientAccess,
  requirePropertyAccess,
} from '../../src/services/access-policy.service.ts';
import { users } from '../../src/models/index.ts';
import { AppError } from '../../src/utils/app-error.ts';
import {
  createClientWithProperty,
  createEngineer,
  createUser,
  resetDb,
  testApp,
  type ClientWithProperty,
  type TestApp,
} from '../helpers.ts';

let ctx: TestApp;
let engenheiroA: string;
let engenheiroB: string;
let admin: string;
let profissional: string;
let clienteA: ClientWithProperty;
let clienteB: ClientWithProperty;

const as = (id: string, role: Role, isDemo = false) => ({ id, role, isDemo });

beforeAll(async () => {
  ctx = await testApp();
});

beforeEach(async () => {
  await resetDb(ctx.db);
  engenheiroA = (await createEngineer(ctx.db)).id;
  engenheiroB = (await createEngineer(ctx.db)).id;
  admin = (await createUser(ctx.db, { role: 'admin' })).id;
  profissional = (await createUser(ctx.db, { role: 'profissional' })).id;
  clienteA = await createClientWithProperty(ctx.db, { engineerId: engenheiroA });
  clienteB = await createClientWithProperty(ctx.db, { engineerId: engenheiroB });
});

afterAll(async () => {
  await ctx.close();
});

async function expectNotFound(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ statusCode: 404, code: 'not_found', message: 'Recurso não encontrado.' });
}

describe('loadClientScope', () => {
  it('admin vê qualquer cliente', async () => {
    const scope = await loadClientScope(ctx.db, as(admin, 'admin'), clienteB.clientId);
    expect(scope).toEqual({ clientId: clienteB.clientId, engineerId: engenheiroB });
  });

  it('engenheiro vê só os clientes dele', async () => {
    expect(await loadClientScope(ctx.db, as(engenheiroA, 'engenheiro'), clienteA.clientId)).toEqual({
      clientId: clienteA.clientId,
      engineerId: engenheiroA,
    });
    expect(await loadClientScope(ctx.db, as(engenheiroA, 'engenheiro'), clienteB.clientId)).toBeNull();
  });

  it('cliente vê só o próprio cadastro', async () => {
    expect(await loadClientScope(ctx.db, as(clienteA.userId, 'cliente'), clienteA.clientId)).not.toBeNull();
    expect(await loadClientScope(ctx.db, as(clienteA.userId, 'cliente'), clienteB.clientId)).toBeNull();
  });

  it('profissional não vê cliente nenhum', async () => {
    expect(await loadClientScope(ctx.db, as(profissional, 'profissional'), clienteA.clientId)).toBeNull();
  });

  it('admin demo vê só cliente de conta demo', async () => {
    await ctx.db.update(users).set({ isDemo: true }).where(eq(users.id, clienteA.userId));
    expect(await loadClientScope(ctx.db, as(admin, 'admin', true), clienteA.clientId)).not.toBeNull();
    expect(await loadClientScope(ctx.db, as(admin, 'admin', true), clienteB.clientId)).toBeNull();
    expect(await loadClientScope(ctx.db, as(admin, 'admin'), clienteB.clientId)).not.toBeNull();
  });

  it('cliente inexistente devolve null', async () => {
    expect(await loadClientScope(ctx.db, as(admin, 'admin'), randomUUID())).toBeNull();
  });
});

describe('requireClientAccess', () => {
  it('cliente lê o próprio cadastro, mas não escreve', async () => {
    const scope = await requireClientAccess(ctx.db, as(clienteA.userId, 'cliente'), clienteA.clientId, 'read');
    expect(scope.clientId).toBe(clienteA.clientId);
    await expectNotFound(requireClientAccess(ctx.db, as(clienteA.userId, 'cliente'), clienteA.clientId, 'write'));
  });

  it('engenheiro dono e admin escrevem', async () => {
    await expect(
      requireClientAccess(ctx.db, as(engenheiroA, 'engenheiro'), clienteA.clientId, 'write'),
    ).resolves.toMatchObject({ clientId: clienteA.clientId });
    await expect(requireClientAccess(ctx.db, as(admin, 'admin'), clienteA.clientId, 'write')).resolves.toMatchObject({
      clientId: clienteA.clientId,
    });
  });

  it('engenheiro de outro cliente recebe 404', async () => {
    await expectNotFound(requireClientAccess(ctx.db, as(engenheiroB, 'engenheiro'), clienteA.clientId, 'read'));
  });
});

describe('requirePropertyAccess', () => {
  it('resolve o cliente do imóvel e devolve o escopo', async () => {
    const scope = await requirePropertyAccess(
      ctx.db,
      as(engenheiroA, 'engenheiro'),
      clienteA.propertyId,
      'write',
    );
    expect(scope).toEqual({ clientId: clienteA.clientId, engineerId: engenheiroA, propertyId: clienteA.propertyId });
  });

  it('reaplica a regra do cliente', async () => {
    await expect(
      requirePropertyAccess(ctx.db, as(clienteA.userId, 'cliente'), clienteA.propertyId, 'read'),
    ).resolves.toMatchObject({ propertyId: clienteA.propertyId });
    await expectNotFound(requirePropertyAccess(ctx.db, as(clienteA.userId, 'cliente'), clienteA.propertyId, 'write'));
    await expectNotFound(requirePropertyAccess(ctx.db, as(engenheiroA, 'engenheiro'), clienteB.propertyId, 'read'));
  });

  it('imóvel inexistente responde 404', async () => {
    await expectNotFound(requirePropertyAccess(ctx.db, as(admin, 'admin'), randomUUID(), 'read'));
  });
});
