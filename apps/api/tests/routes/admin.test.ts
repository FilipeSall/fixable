import { eq } from 'drizzle-orm';
import type { AdminApplication, AdminLead } from '@fixable/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applications, diagnosticLeads, emailOutbox, users } from '../../src/models/index.ts';
import { createClientWithProperty, createEngineer, createUser, loginAs, resetDb, testApp, type TestApp } from '../helpers.ts';

const ORIGIN = 'http://localhost:4321';
const SENHA = 'senha-forte-123';
const FORBIDDEN = { error: { code: 'forbidden', message: 'Você não tem permissão para acessar este recurso.' } };
const JA_ANALISADA = { error: { code: 'conflict', message: 'Esta candidatura já foi analisada.' } };
const CONTA_EXISTE = { error: { code: 'conflict', message: 'Já existe uma conta com este e-mail.' } };
const ID_INEXISTENTE = '3f2b8c1e-5a47-4d6e-9b1a-0c7d2e4f6a81';

let t: TestApp;
let admin: { id: string; email: string };
let adminCookie: string;

beforeEach(async () => {
  t = await testApp();
  await t.app.ready();
  await resetDb(t.db);
  admin = await createUser(t.db, { role: 'admin', senha: SENHA });
  adminCookie = await loginAs(t.app, admin.email, SENHA);
});
afterEach(async () => {
  await t.close();
});

function send(method: 'GET' | 'POST', url: string, cookie: string, payload?: object) {
  return t.app.inject({ method, url, headers: { cookie, origin: ORIGIN }, payload });
}

async function semearLead(p: { nome: string; createdAt: Date; engineerId?: string | null; plano?: '3m' | null }) {
  const [row] = await t.db
    .insert(diagnosticLeads)
    .values({
      nome: p.nome,
      email: `${p.nome.toLowerCase()}@lead.test`,
      telefone: '11999990000',
      cidade: 'Campinas',
      tipoImovel: 'apartamento',
      preferenciaContato: 'whatsapp',
      plano: p.plano ?? null,
      consentAt: p.createdAt,
      engineerId: p.engineerId ?? null,
      createdAt: p.createdAt,
    })
    .returning({ id: diagnosticLeads.id });
  return row!.id;
}

async function semearCandidatura(
  p: {
    nome?: string;
    email?: string;
    area?: 'engenheiro' | 'outro';
    status?: 'pendente' | 'aprovada' | 'recusada';
    createdAt?: Date;
  } = {},
) {
  const [row] = await t.db
    .insert(applications)
    .values({
      nome: p.nome ?? 'Paulo Lima',
      email: p.email ?? 'paulo@candidato.test',
      telefone: '11988887777',
      cidade: 'Santo André',
      area: p.area ?? 'engenheiro',
      status: p.status ?? 'pendente',
      consentAt: new Date(),
      createdAt: p.createdAt ?? new Date(),
    })
    .returning({ id: applications.id });
  return row!.id;
}

async function candidatura(id: string) {
  const [row] = await t.db.select().from(applications).where(eq(applications.id, id));
  return row!;
}

function usuariosCom(email: string) {
  return t.db.select().from(users).where(eq(users.email, email));
}

function convites() {
  return t.db.select().from(emailOutbox).where(eq(emailOutbox.template, 'convite'));
}

describe('acesso ao /api/admin', () => {
  it('cliente, engenheiro e profissional recebem 403 em todas as rotas; sem sessão 401', async () => {
    const engenheiro = await createEngineer(t.db, { senha: SENHA });
    const profissional = await createUser(t.db, { role: 'profissional', senha: SENHA });
    const cliente = await createClientWithProperty(t.db, { senha: SENHA });
    const id = await semearCandidatura();
    const rotas: ['GET' | 'POST', string, object?][] = [
      ['GET', '/api/admin/leads'],
      ['GET', '/api/admin/applications'],
      ['POST', `/api/admin/applications/${id}/approve`],
      ['POST', `/api/admin/applications/${id}/refuse`],
      ['POST', '/api/admin/invites', { nome: 'Nova Pessoa', email: 'nova@fixable.test', role: 'admin' }],
    ];
    for (const email of [cliente.email, engenheiro.email, profissional.email]) {
      const cookie = await loginAs(t.app, email, SENHA);
      for (const [method, url, payload] of rotas) {
        const response = await send(method, url, cookie, payload);
        expect(response.statusCode, `${email} ${method} ${url}`).toBe(403);
        expect(response.json()).toEqual(FORBIDDEN);
      }
    }
    for (const [method, url, payload] of rotas) {
      const response = await t.app.inject({ method, url, headers: { origin: ORIGIN }, payload });
      expect(response.statusCode).toBe(401);
    }
    expect((await candidatura(id)).status).toBe('pendente');
    expect(await usuariosCom('nova@fixable.test')).toHaveLength(0);
  });
});

describe('GET /api/admin/leads', () => {
  it('lista do mais novo ao mais antigo com o engenheiro atribuído', async () => {
    const engenheiro = await createEngineer(t.db, { nome: 'Rafael Costa' });
    const antigo = await semearLead({ nome: 'Ana', createdAt: new Date('2026-10-01T10:00:00Z'), plano: '3m' });
    const novo = await semearLead({
      nome: 'Bruno',
      createdAt: new Date('2026-11-01T10:00:00Z'),
      engineerId: engenheiro.id,
    });
    const response = await send('GET', '/api/admin/leads', adminCookie);
    expect(response.statusCode).toBe(200);
    expect(response.json<AdminLead[]>()).toEqual([
      {
        id: novo,
        nome: 'Bruno',
        email: 'bruno@lead.test',
        telefone: '11999990000',
        cidade: 'Campinas',
        tipoImovel: 'apartamento',
        plano: null,
        engenheiro: { nome: 'Rafael Costa' },
        createdAt: '2026-11-01T10:00:00.000Z',
      },
      {
        id: antigo,
        nome: 'Ana',
        email: 'ana@lead.test',
        telefone: '11999990000',
        cidade: 'Campinas',
        tipoImovel: 'apartamento',
        plano: '3m',
        engenheiro: null,
        createdAt: '2026-10-01T10:00:00.000Z',
      },
    ]);
  });

  it('o filtro "sem" mostra só os leads sem engenheiro; "todos" mostra tudo', async () => {
    const engenheiro = await createEngineer(t.db);
    const sem = await semearLead({ nome: 'Ana', createdAt: new Date('2026-10-01T10:00:00Z') });
    await semearLead({ nome: 'Bruno', createdAt: new Date('2026-11-01T10:00:00Z'), engineerId: engenheiro.id });
    const filtrado = await send('GET', '/api/admin/leads?atribuicao=sem', adminCookie);
    expect(filtrado.json<AdminLead[]>().map((lead) => lead.id)).toEqual([sem]);
    const todos = await send('GET', '/api/admin/leads?atribuicao=todos', adminCookie);
    expect(todos.json<AdminLead[]>()).toHaveLength(2);
  });

  it('filtro desconhecido responde 400', async () => {
    const response = await send('GET', '/api/admin/leads?atribuicao=outro', adminCookie);
    expect(response.statusCode).toBe(400);
  });
});

describe('GET /api/admin/applications', () => {
  it('lista todas da mais nova à mais antiga e filtra por status', async () => {
    const pendente = await semearCandidatura({ email: 'a@c.test', createdAt: new Date('2026-11-03T10:00:00Z') });
    const aprovada = await semearCandidatura({
      email: 'b@c.test',
      status: 'aprovada',
      area: 'outro',
      createdAt: new Date('2026-11-02T10:00:00Z'),
    });
    const recusada = await semearCandidatura({
      email: 'c@c.test',
      status: 'recusada',
      createdAt: new Date('2026-11-01T10:00:00Z'),
    });
    const todas = await send('GET', '/api/admin/applications', adminCookie);
    expect(todas.statusCode).toBe(200);
    expect(todas.json<AdminApplication[]>().map((item) => item.id)).toEqual([pendente, aprovada, recusada]);
    expect(todas.json<AdminApplication[]>()[1]).toEqual({
      id: aprovada,
      nome: 'Paulo Lima',
      email: 'b@c.test',
      telefone: '11988887777',
      cidade: 'Santo André',
      area: 'outro',
      status: 'aprovada',
      createdAt: '2026-11-02T10:00:00.000Z',
    });
    const filtrada = await send('GET', '/api/admin/applications?status=pendente', adminCookie);
    expect(filtrada.json<AdminApplication[]>().map((item) => item.id)).toEqual([pendente]);
  });
});

describe('POST /api/admin/applications/:id/approve', () => {
  it('engenheiro aprovado vira conta convidada de engenheiro e recebe o convite', async () => {
    const id = await semearCandidatura({ nome: 'Paulo Lima', email: 'paulo@candidato.test' });
    const response = await send('POST', `/api/admin/applications/${id}/approve`, adminCookie);
    expect(response.statusCode).toBe(200);
    expect(response.json<AdminApplication>()).toMatchObject({ id, status: 'aprovada' });
    const [conta] = await usuariosCom('paulo@candidato.test');
    expect(conta).toMatchObject({
      role: 'engenheiro',
      status: 'convidado',
      nome: 'Paulo Lima',
      telefone: '11988887777',
      cidade: 'Santo André',
      passwordHash: null,
    });
    const fila = await convites();
    expect(fila).toHaveLength(1);
    expect(fila[0]).toMatchObject({ to: 'paulo@candidato.test', data: { nome: 'Paulo Lima' } });
    expect(fila[0]!.emailTokenId).not.toBeNull();
  });

  it('área "outro" vira profissional', async () => {
    const id = await semearCandidatura({ area: 'outro', email: 'pro@candidato.test' });
    expect((await send('POST', `/api/admin/applications/${id}/approve`, adminCookie)).statusCode).toBe(200);
    const [conta] = await usuariosCom('pro@candidato.test');
    expect(conta?.role).toBe('profissional');
  });

  it('aprovar duas vezes em paralelo cria uma conta e envia um convite', async () => {
    const id = await semearCandidatura();
    const url = `/api/admin/applications/${id}/approve`;
    const respostas = await Promise.all([send('POST', url, adminCookie), send('POST', url, adminCookie)]);
    expect(respostas.map((item) => item.statusCode).sort((a, b) => a - b)).toEqual([200, 409]);
    expect(respostas.find((item) => item.statusCode === 409)?.json()).toEqual(JA_ANALISADA);
    expect(await usuariosCom('paulo@candidato.test')).toHaveLength(1);
    expect(await convites()).toHaveLength(1);
  });

  it('candidatura já analisada responde 409', async () => {
    for (const status of ['aprovada', 'recusada'] as const) {
      const id = await semearCandidatura({ status, email: `${status}@candidato.test` });
      const response = await send('POST', `/api/admin/applications/${id}/approve`, adminCookie);
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual(JA_ANALISADA);
    }
    expect(await t.db.select().from(users)).toHaveLength(1);
  });

  it('e-mail que já tem conta responde 409 e a candidatura continua pendente', async () => {
    await createUser(t.db, { role: 'cliente', email: 'paulo@candidato.test' });
    const id = await semearCandidatura();
    const response = await send('POST', `/api/admin/applications/${id}/approve`, adminCookie);
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(CONTA_EXISTE);
    expect((await candidatura(id)).status).toBe('pendente');
    expect(await convites()).toHaveLength(0);
  });

  it('candidatura inexistente responde 404', async () => {
    const response = await send('POST', `/api/admin/applications/${ID_INEXISTENTE}/approve`, adminCookie);
    expect(response.statusCode).toBe(404);
  });
});

describe('POST /api/admin/applications/:id/refuse', () => {
  it('marca recusada sem criar conta nem enviar e-mail', async () => {
    const id = await semearCandidatura();
    const response = await send('POST', `/api/admin/applications/${id}/refuse`, adminCookie);
    expect(response.statusCode).toBe(200);
    expect(response.json<AdminApplication>()).toMatchObject({ id, status: 'recusada' });
    expect(await usuariosCom('paulo@candidato.test')).toHaveLength(0);
    expect(await t.db.select().from(emailOutbox)).toHaveLength(0);
  });

  it('recusar candidatura já aprovada responde 409 e nada muda', async () => {
    const id = await semearCandidatura({ status: 'aprovada' });
    const response = await send('POST', `/api/admin/applications/${id}/refuse`, adminCookie);
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(JA_ANALISADA);
    expect((await candidatura(id)).status).toBe('aprovada');
  });
});

describe('POST /api/admin/invites', () => {
  it('convida um engenheiro', async () => {
    const response = await send('POST', '/api/admin/invites', adminCookie, {
      nome: 'Rafael Costa',
      email: ' Rafael@Fixable.test ',
      role: 'engenheiro',
    });
    expect(response.statusCode).toBe(201);
    const [conta] = await usuariosCom('rafael@fixable.test');
    expect(conta).toMatchObject({ role: 'engenheiro', status: 'convidado', nome: 'Rafael Costa' });
    expect(response.json()).toEqual({ userId: conta!.id, convite: 'enviado' });
    const fila = await convites();
    expect(fila).toHaveLength(1);
    expect(fila[0]).toMatchObject({ to: 'rafael@fixable.test' });
  });

  it('convida um admin', async () => {
    const response = await send('POST', '/api/admin/invites', adminCookie, {
      nome: 'Carla Dias',
      email: 'carla@fixable.test',
      role: 'admin',
    });
    expect(response.statusCode).toBe(201);
    const [conta] = await usuariosCom('carla@fixable.test');
    expect(conta).toMatchObject({ role: 'admin', status: 'convidado' });
    expect(await convites()).toHaveLength(1);
  });

  it('e-mail com conta ativa responde 409 sem enviar convite', async () => {
    await createEngineer(t.db, { email: 'rafael@fixable.test' });
    const response = await send('POST', '/api/admin/invites', adminCookie, {
      nome: 'Rafael Costa',
      email: 'rafael@fixable.test',
      role: 'engenheiro',
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(CONTA_EXISTE);
    expect(await convites()).toHaveLength(0);
  });

  it('convidado do mesmo papel que ainda não aceitou recebe o convite de novo', async () => {
    const pendente = await createEngineer(t.db, { email: 'rafael@fixable.test', status: 'convidado' });
    const response = await send('POST', '/api/admin/invites', adminCookie, {
      nome: 'Rafael Costa',
      email: 'rafael@fixable.test',
      role: 'engenheiro',
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ userId: pendente.id, convite: 'reenviado' });
    expect(await convites()).toHaveLength(1);
  });

  it('convidado de outro papel responde 409', async () => {
    await createUser(t.db, { role: 'cliente', email: 'rafael@fixable.test', status: 'convidado' });
    const response = await send('POST', '/api/admin/invites', adminCookie, {
      nome: 'Rafael Costa',
      email: 'rafael@fixable.test',
      role: 'admin',
    });
    expect(response.statusCode).toBe(409);
    expect(await convites()).toHaveLength(0);
  });

  it('papel fora de engenheiro e admin responde 400', async () => {
    const response = await send('POST', '/api/admin/invites', adminCookie, {
      nome: 'Rafael Costa',
      email: 'rafael@fixable.test',
      role: 'cliente',
    });
    expect(response.statusCode).toBe(400);
  });
});
