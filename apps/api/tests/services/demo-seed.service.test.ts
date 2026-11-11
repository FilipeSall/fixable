import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { count, eq, inArray } from 'drizzle-orm';
import { DEMO_SENHA } from '@fixable/shared';
import {
  appointments,
  clients,
  floors,
  properties,
  propertyAttributes,
  rooms,
  serviceRequests,
  services,
  users,
} from '../../src/models/index.ts';
import { removeDemo, seedDemo } from '../../src/services/demo-seed.service.ts';
import type { Db } from '../../src/types/db.types.ts';
import {
  createClientWithProperty,
  createEngineer,
  createUser,
  loginAs,
  resetDb,
  testApp,
  type TestApp,
} from '../helpers.ts';

let ctx: TestApp;
const ON = { DEMO_MODE: true };
const NOW = new Date('2026-11-11T15:00:00Z');
const HOUR_MS = 60 * 60 * 1000;

const DEMO_EMAILS = [
  'admin.demo@fixable.com.br',
  'rafael.demo@fixable.com.br',
  'ana.demo@fixable.com.br',
  'carlos.demo@fixable.com.br',
  'juliana.demo@fixable.com.br',
];

async function tableCounts(db: Db) {
  const tables = {
    users,
    clients,
    properties,
    propertyAttributes,
    floors,
    rooms,
    services,
    serviceRequests,
    appointments,
  };
  const entries = await Promise.all(
    Object.entries(tables).map(async ([name, table]) => {
      const [row] = await db.select({ total: count() }).from(table);
      return [name, row!.total] as const;
    }),
  );
  return Object.fromEntries(entries);
}

async function clientIdOf(db: Db, email: string): Promise<string> {
  const [row] = await db
    .select({ id: clients.id })
    .from(clients)
    .innerJoin(users, eq(clients.userId, users.id))
    .where(eq(users.email, email));
  return row!.id;
}

beforeEach(async () => {
  ctx ??= await testApp(ON);
  await resetDb(ctx.db);
});

afterAll(async () => {
  await ctx?.close();
});

describe('seedDemo', () => {
  it('recusa rodar sem DEMO_MODE e não grava nada', async () => {
    await expect(seedDemo(ctx.db, { DEMO_MODE: false }, NOW)).rejects.toThrow(/DEMO_MODE=true/);
    expect((await tableCounts(ctx.db)).users).toBe(0);
  });

  it('cria as cinco contas demo ativas, com a senha conhecida, e os três clientes do Rafael', async () => {
    const summary = await seedDemo(ctx.db, ON, NOW);
    expect(summary).toEqual({ usuarios: 5, clientes: 3, servicos: 8, solicitacoes: 7, agendamentos: 8 });

    const contas = await ctx.db
      .select({ email: users.email, role: users.role, status: users.status, isDemo: users.isDemo })
      .from(users)
      .where(inArray(users.email, DEMO_EMAILS));
    expect(contas).toHaveLength(5);
    expect(contas.every((conta) => conta.status === 'ativo' && conta.isDemo)).toBe(true);

    const cookie = await loginAs(ctx.app, 'rafael.demo@fixable.com.br', DEMO_SENHA);
    const response = await ctx.app.inject({ method: 'GET', url: '/api/clients', headers: { cookie } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      stats: { clientes: 3, solicitacoesAbertas: 6, servicosEmAndamento: 5, agendamentosAConfirmar: 4 },
    });
    const porNome = Object.fromEntries(
      response.json<{ clients: { nome: string }[] }>().clients.map((client) => [client.nome, client]),
    );
    expect(porNome['Ana Souza']).toMatchObject({ tipoImovel: 'sobrado', servicosAtivos: 3, solicitacoesAbertas: 3 });
    expect(porNome['Carlos Mendes']).toMatchObject({ tipoImovel: 'apartamento', servicosAtivos: 2 });
    expect(porNome['Juliana Prado']).toMatchObject({ tipoImovel: 'casa_terrea', cidade: 'Santo André' });
  });

  it('liga cada serviço ao cômodo certo da planta padrão e mantém um concluído dentro das 24 h', async () => {
    await seedDemo(ctx.db, ON, NOW);
    const anaId = await clientIdOf(ctx.db, 'ana.demo@fixable.com.br');
    const rows = await ctx.db
      .select({ titulo: services.titulo, comodo: rooms.nome, andar: floors.nome })
      .from(services)
      .innerJoin(properties, eq(services.propertyId, properties.id))
      .innerJoin(rooms, eq(services.roomId, rooms.id))
      .innerJoin(floors, eq(rooms.floorId, floors.id))
      .where(eq(properties.clientId, anaId));
    expect(rows).toContainEqual({ titulo: 'Infiltração no box da suíte', comodo: 'Suíte', andar: 'Andar 2' });
    expect(rows).toContainEqual({
      titulo: 'Adequação do quadro elétrico',
      comodo: 'Área de serviço',
      andar: 'Andar 1',
    });

    const concluidos = await ctx.db
      .select({ concludedAt: services.concludedAt })
      .from(services)
      .where(eq(services.status, 'concluido'));
    const recentes = concluidos.filter((row) => NOW.getTime() - row.concludedAt!.getTime() < 24 * HOUR_MS);
    expect(recentes).toHaveLength(1);
    expect(concluidos.every((row) => row.concludedAt !== null)).toBe(true);

    const atributos = await ctx.db
      .select({ chave: propertyAttributes.chave })
      .from(propertyAttributes)
      .innerJoin(properties, eq(propertyAttributes.propertyId, properties.id))
      .where(eq(properties.clientId, anaId));
    expect(atributos.map((row) => row.chave)).toContain('Área construída');
  });

  it('agenda no mês atual e no próximo, com os três status, relativo a hoje', async () => {
    await seedDemo(ctx.db, ON, NOW);
    const rows = await ctx.db.select({ data: appointments.data, status: appointments.status }).from(appointments);
    const meses = new Set(rows.map((row) => row.data.slice(0, 7)));
    expect(meses).toEqual(new Set(['2026-11', '2026-12']));
    expect(new Set(rows.map((row) => row.status))).toEqual(new Set(['confirmado', 'pendente', 'adiado']));
    expect(rows).toContainEqual({ data: '2026-11-11', status: 'pendente' });
  });

  it('rodar de novo não duplica nada', async () => {
    await seedDemo(ctx.db, ON, NOW);
    const antes = await tableCounts(ctx.db);
    await seedDemo(ctx.db, ON, new Date(NOW.getTime() + HOUR_MS));
    expect(await tableCounts(ctx.db)).toEqual(antes);
  });

  it('não toca em clientes, engenheiros e serviços reais', async () => {
    const engenheiro = await createEngineer(ctx.db, { nome: 'Engenheira Real' });
    const real = await createClientWithProperty(ctx.db, { engineerId: engenheiro.id, nome: 'Cliente Real' });
    await ctx.db.insert(services).values({ propertyId: real.propertyId, titulo: 'Real', status: 'atencao' });
    await ctx.db.insert(serviceRequests).values({ clientId: real.clientId, descricao: 'Pedido real' });

    await seedDemo(ctx.db, ON, NOW);
    await seedDemo(ctx.db, ON, NOW);

    const [cliente] = await ctx.db.select().from(clients).where(eq(clients.id, real.clientId));
    expect(cliente?.engineerId).toBe(engenheiro.id);
    expect(await ctx.db.select().from(services).where(eq(services.propertyId, real.propertyId))).toHaveLength(1);
    expect(await ctx.db.select().from(serviceRequests).where(eq(serviceRequests.clientId, real.clientId))).toHaveLength(
      1,
    );
    const [eng] = await ctx.db.select({ isDemo: users.isDemo }).from(users).where(eq(users.id, engenheiro.id));
    expect(eng?.isDemo).toBe(false);
  });

  it('recusa sobrescrever uma conta real que use um e-mail da demonstração', async () => {
    await createUser(ctx.db, { role: 'cliente', email: 'ana.demo@fixable.com.br', nome: 'Ana de verdade' });
    await expect(seedDemo(ctx.db, ON, NOW)).rejects.toThrow(/ana\.demo@fixable\.com\.br/);
    const [ana] = await ctx.db.select().from(users).where(eq(users.email, 'ana.demo@fixable.com.br'));
    expect(ana).toMatchObject({ nome: 'Ana de verdade', isDemo: false });
    expect((await tableCounts(ctx.db)).users).toBe(1);
  });
});

describe('removeDemo', () => {
  it('apaga as contas demo e os dados delas, mesmo com DEMO_MODE desligado, sem tocar no resto', async () => {
    const real = await createClientWithProperty(ctx.db, { nome: 'Cliente Real' });
    await seedDemo(ctx.db, ON, NOW);

    expect(await removeDemo(ctx.db)).toEqual({ usuarios: 5 });

    const restantes = await tableCounts(ctx.db);
    expect(restantes).toMatchObject({ users: 1, clients: 1, properties: 1, services: 0, appointments: 0 });
    const [cliente] = await ctx.db.select({ id: clients.id }).from(clients);
    expect(cliente?.id).toBe(real.clientId);
  });
});
