import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, isNull } from 'drizzle-orm';
import { DEMO_SENHA } from '@fixable/shared';
import { applications, clients, diagnosticLeads, users } from '../../src/models/index.ts';
import { removeDemo, seedDemo } from '../../src/services/demo-seed.service.ts';
import { createUser, loginAs, resetDb, testApp, type TestApp } from '../helpers.ts';

let ctx: TestApp;
const ON = { DEMO_MODE: true };
const ORIGIN = 'http://localhost:4321';
const RAFAEL = 'rafael.demo@fixable.com.br';

beforeEach(async () => {
  ctx ??= await testApp(ON);
  await resetDb(ctx.db);
});

afterAll(async () => {
  await ctx?.close();
});

async function insertRealLeadAndApplication() {
  const agora = new Date();
  await ctx.db.insert(diagnosticLeads).values({
    nome: 'Visitante Real',
    email: 'visitante@exemplo.com',
    telefone: '(11) 90000-0000',
    cidade: 'Osasco',
    tipoImovel: 'sobrado',
    preferenciaContato: 'whatsapp',
    consentAt: agora,
  });
  await ctx.db.insert(applications).values({
    nome: 'Candidato Real',
    email: 'candidato@exemplo.com',
    telefone: '(11) 90000-0001',
    cidade: 'Osasco',
    area: 'engenheiro',
    consentAt: agora,
  });
}

async function adminGet(cookie: string, url: string) {
  const response = await ctx.app.inject({ method: 'GET', url, headers: { cookie } });
  expect(response.statusCode).toBe(200);
  return response.json<{ id: string; email: string; engenheiro?: { nome: string } | null }[]>();
}

async function approve(cookie: string, id: string) {
  return ctx.app.inject({
    method: 'POST',
    url: `/api/admin/applications/${id}/approve`,
    headers: { cookie, origin: ORIGIN },
  });
}

describe('seedDemo: leads e candidaturas para as telas do admin', () => {
  it('cria um lead por cliente demo, ligado ao cliente e ao Rafael, e dois sem atribuição', async () => {
    await seedDemo(ctx.db, ON);
    const leads = await ctx.db.select().from(diagnosticLeads);
    expect(leads).toHaveLength(5);
    const [rafael] = await ctx.db.select({ id: users.id }).from(users).where(eq(users.email, RAFAEL));
    const atribuidos = leads.filter((lead) => lead.engineerId !== null);
    expect(atribuidos).toHaveLength(3);
    expect(atribuidos.every((lead) => lead.engineerId === rafael!.id && lead.clientId !== null)).toBe(true);
    const clientIds = (await ctx.db.select({ id: clients.id }).from(clients)).map((row) => row.id);
    expect(new Set(atribuidos.map((lead) => lead.clientId))).toEqual(new Set(clientIds));
    const semAtribuicao = leads.filter((lead) => lead.engineerId === null);
    expect(semAtribuicao.every((lead) => lead.clientId === null)).toBe(true);
    expect(leads.some((lead) => lead.plano !== null)).toBe(true);
    expect(leads.every((lead) => lead.createdAt.getTime() < Date.now())).toBe(true);
  });

  it('cria candidaturas pendentes de engenheiro e de outra área, uma aprovada e uma recusada', async () => {
    await seedDemo(ctx.db, ON);
    const rows = await ctx.db.select({ status: applications.status, area: applications.area }).from(applications);
    const pendentes = rows.filter((row) => row.status === 'pendente').map((row) => row.area);
    expect(pendentes.toSorted((a, b) => a.localeCompare(b))).toEqual(['engenheiro', 'outro']);
    expect(rows.filter((row) => row.status === 'aprovada')).toHaveLength(1);
    expect(rows.filter((row) => row.status === 'recusada')).toHaveLength(1);
  });

  it('o admin demo vê os leads e as candidaturas pendentes', async () => {
    await seedDemo(ctx.db, ON);
    const cookie = await loginAs(ctx.app, 'admin.demo@fixable.com.br', DEMO_SENHA);
    expect(await adminGet(cookie, '/api/admin/leads?atribuicao=todos')).toHaveLength(5);
    expect(await adminGet(cookie, '/api/admin/leads?atribuicao=sem')).toHaveLength(2);
    expect(await adminGet(cookie, '/api/admin/applications?status=pendente')).toHaveLength(2);
  });

  it('aprovar uma candidatura demo cria conta demo; o reseed a apaga e a candidatura volta a pendente', async () => {
    await seedDemo(ctx.db, ON);
    const cookie = await loginAs(ctx.app, 'admin.demo@fixable.com.br', DEMO_SENHA);
    const pendentes = await adminGet(cookie, '/api/admin/applications?status=pendente');
    const engenheira = (await ctx.db.select().from(applications)).find(
      (row) => row.status === 'pendente' && row.area === 'engenheiro',
    )!;
    expect((await approve(cookie, engenheira.id)).statusCode).toBe(200);
    const [criada] = await ctx.db.select().from(users).where(eq(users.email, engenheira.email));
    expect(criada).toMatchObject({ role: 'engenheiro', status: 'convidado', isDemo: true });
    expect(pendentes.map((row) => row.email)).toContain(engenheira.email);

    await seedDemo(ctx.db, ON);
    expect(await ctx.db.select().from(users).where(eq(users.email, engenheira.email))).toHaveLength(0);
    const [denovo] = await ctx.db.select().from(applications).where(eq(applications.email, engenheira.email));
    expect(denovo?.status).toBe('pendente');
    const novoCookie = await loginAs(ctx.app, 'admin.demo@fixable.com.br', DEMO_SENHA);
    expect((await approve(novoCookie, denovo!.id)).statusCode).toBe(200);
  });

  it('o admin real aprova candidatura real e cria conta comum, fora da demonstração', async () => {
    await insertRealLeadAndApplication();
    await seedDemo(ctx.db, ON);
    const admin = await createUser(ctx.db, { role: 'admin', senha: 'senha-forte-123' });
    const cookie = await loginAs(ctx.app, admin.email, 'senha-forte-123');
    const [real] = await ctx.db.select().from(applications).where(eq(applications.email, 'candidato@exemplo.com'));
    expect((await approve(cookie, real!.id)).statusCode).toBe(200);
    const [conta] = await ctx.db.select().from(users).where(eq(users.email, 'candidato@exemplo.com'));
    expect(conta?.isDemo).toBe(false);
  });

  it('reseed e remoção nunca tocam em leads e candidaturas reais', async () => {
    await insertRealLeadAndApplication();
    await seedDemo(ctx.db, ON);
    await seedDemo(ctx.db, ON);
    expect(await ctx.db.select().from(diagnosticLeads)).toHaveLength(6);
    expect(await ctx.db.select().from(applications)).toHaveLength(5);

    await removeDemo(ctx.db);
    const leads = await ctx.db.select({ email: diagnosticLeads.email }).from(diagnosticLeads);
    const candidaturas = await ctx.db.select({ email: applications.email }).from(applications);
    expect(leads).toEqual([{ email: 'visitante@exemplo.com' }]);
    expect(candidaturas).toEqual([{ email: 'candidato@exemplo.com' }]);
    expect(await ctx.db.select().from(diagnosticLeads).where(isNull(diagnosticLeads.engineerId))).toHaveLength(1);
  });

  it('a remoção apaga também as contas criadas ao aprovar candidaturas demo', async () => {
    await seedDemo(ctx.db, ON);
    const cookie = await loginAs(ctx.app, 'admin.demo@fixable.com.br', DEMO_SENHA);
    const pendente = (await ctx.db.select().from(applications)).find((row) => row.status === 'pendente')!;
    expect((await approve(cookie, pendente.id)).statusCode).toBe(200);

    expect(await removeDemo(ctx.db)).toEqual({ usuarios: 6 });
    expect(await ctx.db.select().from(users)).toHaveLength(0);
  });
});
