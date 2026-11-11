import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { DEMO_SENHA } from '@fixable/shared';
import { applications, appointments, diagnosticLeads, users } from '../../src/models/index.ts';
import { seedDemo } from '../../src/services/demo-seed.service.ts';
import { todayIn } from '../../src/utils/calendar-date.ts';
import {
  createClientWithProperty,
  createEngineer,
  createUser,
  loginAs,
  resetDb,
  testApp,
  type ClientWithProperty,
  type TestApp,
} from '../helpers.ts';

const ON = { DEMO_MODE: true };
const ORIGIN = 'http://localhost:4321';
const SENHA = 'senha-forte-123';
const DEMO_ADMIN = 'admin.demo@fixable.com.br';
const INDISPONIVEL = { error: { code: 'forbidden', message: 'Indisponível no modo demonstração.' } };
const NAO_ENCONTRADO = { error: { code: 'not_found', message: 'Recurso não encontrado.' } };

let ctx: TestApp;
let realClient: ClientWithProperty;
let realApplicationId: string;
let demoCookie: string;
let realAdminCookie: string;

beforeEach(async () => {
  ctx = await testApp(ON);
  await resetDb(ctx.db);
  await seedDemo(ctx.db, ON);
  const engenheiro = await createEngineer(ctx.db);
  realClient = await createClientWithProperty(ctx.db, { engineerId: engenheiro.id, nome: 'Cliente Real' });
  const agora = new Date();
  await ctx.db.insert(appointments).values({
    clientId: realClient.clientId,
    propertyId: realClient.propertyId,
    servico: 'Visita real',
    data: todayIn('America/Sao_Paulo', agora),
    hora: '10:00',
  });
  await ctx.db.insert(diagnosticLeads).values({
    nome: 'Visitante Real',
    email: 'visitante@exemplo.com',
    telefone: '11900000000',
    cidade: 'Osasco',
    tipoImovel: 'sobrado',
    preferenciaContato: 'whatsapp',
    consentAt: agora,
  });
  const [application] = await ctx.db
    .insert(applications)
    .values({
      nome: 'Candidato Real',
      email: 'candidato@exemplo.com',
      telefone: '11900000001',
      cidade: 'Osasco',
      area: 'engenheiro',
      consentAt: agora,
    })
    .returning({ id: applications.id });
  realApplicationId = application!.id;
  const realAdmin = await createUser(ctx.db, { role: 'admin', senha: SENHA });
  realAdminCookie = await loginAs(ctx.app, realAdmin.email, SENHA);
  demoCookie = await loginAs(ctx.app, DEMO_ADMIN, DEMO_SENHA);
});

afterEach(async () => {
  await ctx.close();
});

function send(method: 'GET' | 'POST', url: string, cookie: string, payload?: object) {
  return ctx.app.inject({ method, url, headers: { cookie, origin: ORIGIN }, payload });
}

async function emails(url: string, cookie: string): Promise<string[]> {
  const response = await send('GET', url, cookie);
  expect(response.statusCode).toBe(200);
  return response.json<{ email: string }[]>().map((row) => row.email);
}

async function clientNames(cookie: string): Promise<string[]> {
  const response = await send('GET', '/api/clients', cookie);
  expect(response.statusCode).toBe(200);
  return response.json<{ clients: { nome: string }[] }>().clients.map((row) => row.nome);
}

async function calendarNames(cookie: string): Promise<string[]> {
  const mes = todayIn('America/Sao_Paulo', new Date()).slice(0, 7);
  const response = await send('GET', `/api/appointments?mes=${mes}`, cookie);
  expect(response.statusCode).toBe(200);
  return response.json<{ clientNome: string }[]>().map((row) => row.clientNome);
}

async function applicationStatus(id: string) {
  const [row] = await ctx.db.select({ status: applications.status }).from(applications).where(eq(applications.id, id));
  return row?.status;
}

describe('admin demo fica restrito aos dados da demonstração', () => {
  it('não convida ninguém para a equipe', async () => {
    const response = await send('POST', '/api/admin/invites', demoCookie, {
      nome: 'Invasor Qualquer',
      email: 'invasor@exemplo.com',
      role: 'admin',
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(INDISPONIVEL);
    expect(await ctx.db.select().from(users).where(eq(users.email, 'invasor@exemplo.com'))).toHaveLength(0);
  });

  it('vê só leads e candidaturas do domínio da demonstração', async () => {
    const leads = await emails('/api/admin/leads?atribuicao=todos', demoCookie);
    expect(leads).toHaveLength(5);
    expect(leads).not.toContain('visitante@exemplo.com');
    const candidaturas = await emails('/api/admin/applications', demoCookie);
    expect(candidaturas).toHaveLength(4);
    expect(candidaturas).not.toContain('candidato@exemplo.com');
  });

  it('não aprova nem recusa candidatura real', async () => {
    for (const acao of ['approve', 'refuse']) {
      const response = await send('POST', `/api/admin/applications/${realApplicationId}/${acao}`, demoCookie);
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NAO_ENCONTRADO);
    }
    expect(await applicationStatus(realApplicationId)).toBe('pendente');
    expect(await ctx.db.select().from(users).where(eq(users.email, 'candidato@exemplo.com'))).toHaveLength(0);
  });

  it('não vê cliente real na lista, no detalhe, no imóvel nem na agenda', async () => {
    const nomes = await clientNames(demoCookie);
    expect(nomes).toHaveLength(3);
    expect(nomes).not.toContain('Cliente Real');
    const detalhe = await send('GET', `/api/clients/${realClient.clientId}`, demoCookie);
    expect(detalhe.statusCode).toBe(404);
    const imovel = await send('GET', `/api/properties/${realClient.propertyId}/attributes`, demoCookie);
    expect(imovel.statusCode).toBe(404);
    expect(await calendarNames(demoCookie)).not.toContain('Cliente Real');
  });
});

describe('admin real continua vendo tudo', () => {
  it('vê leads, candidaturas, clientes e agenda reais e demo', async () => {
    expect(await emails('/api/admin/leads?atribuicao=todos', realAdminCookie)).toHaveLength(6);
    expect(await emails('/api/admin/applications', realAdminCookie)).toHaveLength(5);
    expect(await clientNames(realAdminCookie)).toHaveLength(4);
    expect(await calendarNames(realAdminCookie)).toContain('Cliente Real');
    const detalhe = await send('GET', `/api/clients/${realClient.clientId}`, realAdminCookie);
    expect(detalhe.statusCode).toBe(200);
  });

  it('aprova candidatura real e convida a equipe', async () => {
    const aprovada = await send('POST', `/api/admin/applications/${realApplicationId}/approve`, realAdminCookie);
    expect(aprovada.statusCode).toBe(200);
    const convite = await send('POST', '/api/admin/invites', realAdminCookie, {
      nome: 'Nova Pessoa',
      email: 'nova@exemplo.com',
      role: 'admin',
    });
    expect(convite.statusCode).toBe(201);
  });
});
