import { eq } from 'drizzle-orm';
import type { ServiceRequest } from '@fixable/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { serviceRequests } from '../../src/models/index.ts';
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

const ORIGIN = 'http://localhost:4321';
const SENHA = 'senha-forte-123';
const NOT_FOUND = { error: { code: 'not_found', message: 'Recurso não encontrado.' } };
const IMOVEL_INVALIDO = { error: { code: 'validation', message: 'Selecione um imóvel deste cliente.' } };

let t: TestApp;
let engA: { id: string; email: string };
let engB: { id: string; email: string };
let admin: { id: string; email: string };
let profissional: { id: string; email: string };
let clienteA: ClientWithProperty;
let clienteB: ClientWithProperty;

beforeEach(async () => {
  t = await testApp();
  await t.app.ready();
  await resetDb(t.db);
  engA = await createEngineer(t.db, { senha: SENHA });
  engB = await createEngineer(t.db, { senha: SENHA });
  admin = await createUser(t.db, { role: 'admin', senha: SENHA });
  profissional = await createUser(t.db, { role: 'profissional', senha: SENHA });
  clienteA = await createClientWithProperty(t.db, { engineerId: engA.id, senha: SENHA, apelido: 'Casa da praia' });
  clienteB = await createClientWithProperty(t.db, { engineerId: engB.id, senha: SENHA });
});
afterEach(async () => {
  await t.close();
});

function send(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, cookie: string, payload?: object) {
  return t.app.inject({ method, url, headers: { cookie, origin: ORIGIN }, payload });
}

function criar(cookie: string, payload: object = {}, clientId = clienteA.clientId) {
  return send('POST', `/api/clients/${clientId}/requests`, cookie, {
    descricao: 'Infiltração na parede do quarto',
    status: 'em_analise',
    ...payload,
  });
}

async function semear(clientId: string, descricao: string, createdAt: Date, propertyId: string | null = null) {
  const [row] = await t.db
    .insert(serviceRequests)
    .values({ clientId, descricao, createdAt, propertyId })
    .returning({ id: serviceRequests.id });
  return row!.id;
}

async function linha(id: string) {
  const [row] = await t.db.select().from(serviceRequests).where(eq(serviceRequests.id, id));
  return row;
}

describe('GET /api/clients/:id/requests', () => {
  it('cliente lê as próprias solicitações, da mais recente à mais antiga, com o imóvel', async () => {
    const antiga = await semear(clienteA.clientId, 'Telhado com goteira', new Date('2026-10-01T10:00:00Z'));
    const nova = await semear(
      clienteA.clientId,
      'Infiltração no quarto',
      new Date('2026-11-01T10:00:00Z'),
      clienteA.propertyId,
    );
    await semear(clienteB.clientId, 'Outra', new Date('2026-11-02T10:00:00Z'));
    const cookie = await loginAs(t.app, clienteA.email, SENHA);
    const response = await send('GET', `/api/clients/${clienteA.clientId}/requests`, cookie);
    expect(response.statusCode).toBe(200);
    expect(response.json<ServiceRequest[]>()).toEqual([
      {
        id: nova,
        descricao: 'Infiltração no quarto',
        status: 'em_analise',
        propertyId: clienteA.propertyId,
        propertyApelido: 'Casa da praia',
        createdAt: '2026-11-01T10:00:00.000Z',
      },
      {
        id: antiga,
        descricao: 'Telhado com goteira',
        status: 'em_analise',
        propertyId: null,
        propertyApelido: null,
        createdAt: '2026-10-01T10:00:00.000Z',
      },
    ]);
  });

  it('engenheiro dono e admin leem; engenheiro de outro, outro cliente e profissional recebem 404', async () => {
    await semear(clienteA.clientId, 'Telhado com goteira', new Date());
    const url = `/api/clients/${clienteA.clientId}/requests`;
    for (const email of [engA.email, admin.email]) {
      const response = await send('GET', url, await loginAs(t.app, email, SENHA));
      expect(response.statusCode).toBe(200);
      expect(response.json<ServiceRequest[]>()).toHaveLength(1);
    }
    for (const email of [engB.email, clienteB.email, profissional.email]) {
      const response = await send('GET', url, await loginAs(t.app, email, SENHA));
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
    }
  });

  it('sem sessão recebe 401', async () => {
    const response = await t.app.inject({ method: 'GET', url: `/api/clients/${clienteA.clientId}/requests` });
    expect(response.statusCode).toBe(401);
  });
});

describe('POST /api/clients/:id/requests', () => {
  it('engenheiro dono cria a solicitação com o imóvel do cliente', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await criar(cookie, { propertyId: clienteA.propertyId, status: 'agendado' });
    expect(response.statusCode).toBe(201);
    const criada = response.json<ServiceRequest>();
    expect(criada).toEqual({
      id: criada.id,
      descricao: 'Infiltração na parede do quarto',
      status: 'agendado',
      propertyId: clienteA.propertyId,
      propertyApelido: 'Casa da praia',
      createdAt: criada.createdAt,
    });
    expect((await linha(criada.id))?.clientId).toBe(clienteA.clientId);
  });

  it('admin cria sem imóvel', async () => {
    const response = await criar(await loginAs(t.app, admin.email, SENHA));
    expect(response.statusCode).toBe(201);
    expect(response.json<ServiceRequest>()).toMatchObject({ propertyId: null, propertyApelido: null });
  });

  it('imóvel de outro cliente responde 400 e nada é criado', async () => {
    const response = await criar(await loginAs(t.app, engA.email, SENHA), { propertyId: clienteB.propertyId });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(IMOVEL_INVALIDO);
    expect(await t.db.select().from(serviceRequests)).toHaveLength(0);
  });

  it('cliente, engenheiro de outro e profissional recebem 404', async () => {
    for (const email of [clienteA.email, engB.email, profissional.email]) {
      const response = await criar(await loginAs(t.app, email, SENHA));
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
    }
    expect(await t.db.select().from(serviceRequests)).toHaveLength(0);
  });

  it('descrição curta responde 400 com a mensagem do modelo', async () => {
    const response = await criar(await loginAs(t.app, engA.email, SENHA), { descricao: 'ab' });
    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { fields: Record<string, string> } }>().error.fields.descricao).toBe('Descreva o que foi solicitado.');
  });
});

describe('PATCH /api/requests/:id', () => {
  it('engenheiro dono muda só o status', async () => {
    const id = await semear(clienteA.clientId, 'Telhado com goteira', new Date(), clienteA.propertyId);
    const response = await send('PATCH', `/api/requests/${id}`, await loginAs(t.app, engA.email, SENHA), {
      status: 'em_execucao',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<ServiceRequest>()).toMatchObject({
      id,
      descricao: 'Telhado com goteira',
      status: 'em_execucao',
      propertyId: clienteA.propertyId,
    });
  });

  it('admin edita a descrição e limpa o imóvel com null', async () => {
    const id = await semear(clienteA.clientId, 'Telhado com goteira', new Date(), clienteA.propertyId);
    const response = await send('PATCH', `/api/requests/${id}`, await loginAs(t.app, admin.email, SENHA), {
      descricao: 'Goteira na sala',
      propertyId: null,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<ServiceRequest>()).toMatchObject({
      descricao: 'Goteira na sala',
      propertyId: null,
      propertyApelido: null,
    });
  });

  it('corpo vazio devolve a solicitação sem mudar nada', async () => {
    const id = await semear(clienteA.clientId, 'Telhado com goteira', new Date());
    const response = await send('PATCH', `/api/requests/${id}`, await loginAs(t.app, engA.email, SENHA), {});
    expect(response.statusCode).toBe(200);
    expect(response.json<ServiceRequest>()).toMatchObject({ id, descricao: 'Telhado com goteira' });
  });

  it('imóvel de outro cliente responde 400 e nada muda', async () => {
    const id = await semear(clienteA.clientId, 'Telhado com goteira', new Date());
    const response = await send('PATCH', `/api/requests/${id}`, await loginAs(t.app, engA.email, SENHA), {
      propertyId: clienteB.propertyId,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(IMOVEL_INVALIDO);
    expect((await linha(id))?.propertyId).toBeNull();
  });

  it('cliente, engenheiro de outro e profissional recebem 404 e nada muda', async () => {
    const id = await semear(clienteA.clientId, 'Telhado com goteira', new Date());
    for (const email of [clienteA.email, engB.email, profissional.email]) {
      const response = await send('PATCH', `/api/requests/${id}`, await loginAs(t.app, email, SENHA), {
        status: 'concluido',
      });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
    }
    expect((await linha(id))?.status).toBe('em_analise');
  });

  it('solicitação inexistente responde 404', async () => {
    const response = await send(
      'PATCH',
      '/api/requests/3f2b8c1e-5a47-4d6e-9b1a-0c7d2e4f6a81',
      await loginAs(t.app, admin.email, SENHA),
      { status: 'concluido' },
    );
    expect(response.statusCode).toBe(404);
  });
});

describe('DELETE /api/requests/:id', () => {
  it('engenheiro dono exclui', async () => {
    const id = await semear(clienteA.clientId, 'Telhado com goteira', new Date());
    const response = await send('DELETE', `/api/requests/${id}`, await loginAs(t.app, engA.email, SENHA));
    expect(response.statusCode).toBe(204);
    expect(await linha(id)).toBeUndefined();
  });

  it('cliente e engenheiro de outro recebem 404 e a solicitação continua', async () => {
    const id = await semear(clienteA.clientId, 'Telhado com goteira', new Date());
    for (const email of [clienteA.email, engB.email]) {
      const response = await send('DELETE', `/api/requests/${id}`, await loginAs(t.app, email, SENHA));
      expect(response.statusCode).toBe(404);
    }
    expect(await linha(id)).toBeDefined();
  });
});
