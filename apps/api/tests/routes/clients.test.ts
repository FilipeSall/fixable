import { asc, eq, inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { floorplanFor, overlaps } from '../../src/services/floorplan.service.ts';
import {
  appointments,
  clients,
  floors,
  properties,
  rooms,
  serviceRequests,
  services,
  users,
} from '../../src/models/index.ts';
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
const DAY_MS = 24 * 60 * 60 * 1000;

let t: TestApp;
let engA: { id: string; email: string };
let engB: { id: string; email: string };
let clienteA: ClientWithProperty;
let clienteB: ClientWithProperty;

beforeEach(async () => {
  t = await testApp();
  await t.app.ready();
  await resetDb(t.db);
  engA = await createEngineer(t.db, { nome: 'Eng. Alice', senha: SENHA });
  engB = await createEngineer(t.db, { nome: 'Eng. Bruno', senha: SENHA });
  clienteA = await createClientWithProperty(t.db, {
    engineerId: engA.id,
    nome: 'Ana Souza',
    senha: SENHA,
    tipo: 'apartamento',
    cidade: 'Recife',
  });
  clienteB = await createClientWithProperty(t.db, { engineerId: engB.id, nome: 'Beto Lima', senha: SENHA });
});
afterEach(async () => {
  await t.close();
});

function get(url: string, cookie?: string) {
  return t.app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} });
}

function post(url: string, cookie: string, payload: object) {
  return t.app.inject({ method: 'POST', url, headers: { cookie, origin: ORIGIN }, payload });
}

async function seedRoom(propertyId: string): Promise<string> {
  const [floor] = await t.db.insert(floors).values({ propertyId, nome: 'Andar 1', posicao: 0 }).returning();
  const [room] = await t.db
    .insert(rooms)
    .values({ floorId: floor!.id, nome: 'Sala', largura: 2, altura: 1, posicao: 0 })
    .returning();
  return room!.id;
}

async function seedActivity(client: ClientWithProperty) {
  const roomId = await seedRoom(client.propertyId);
  const service = { roomId, propertyId: client.propertyId, titulo: 'Serviço' };
  await t.db.insert(services).values([
    { ...service, status: 'prioridade' },
    { ...service, status: 'execucao' },
    { ...service, status: 'concluido', concludedAt: new Date() },
  ]);
  const request = { clientId: client.clientId, propertyId: client.propertyId };
  await t.db.insert(serviceRequests).values([
    { ...request, descricao: 'Vazamento', status: 'em_analise' },
    { ...request, descricao: 'Pintura', status: 'concluido' },
  ]);
  const appointment = { clientId: client.clientId, propertyId: client.propertyId, servico: 'Visita', hora: '09:00' };
  await t.db.insert(appointments).values([
    { ...appointment, data: '2026-12-01', status: 'pendente' },
    { ...appointment, data: '2026-12-02', status: 'confirmado' },
  ]);
}

describe('GET /api/me/client', () => {
  it('devolve o clientId do cliente logado', async () => {
    const cookie = await loginAs(t.app, clienteA.email, SENHA);
    const response = await get('/api/me/client', cookie);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ clientId: clienteA.clientId });
  });

  it('engenheiro recebe 403', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    expect((await get('/api/me/client', cookie)).statusCode).toBe(403);
  });

  it('sem sessão recebe 401', async () => {
    expect((await get('/api/me/client')).statusCode).toBe(401);
  });
});

describe('GET /api/clients/:id', () => {
  it('cliente lê o próprio cadastro', async () => {
    await t.db.update(users).set({ telefone: '(81) 90000-0000' }).where(eq(users.id, clienteA.userId));
    const cookie = await loginAs(t.app, clienteA.email, SENHA);
    const response = await get(`/api/clients/${clienteA.clientId}`, cookie);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: clienteA.clientId,
      nome: 'Ana Souza',
      email: clienteA.email,
      telefone: '(81) 90000-0000',
      engenheiro: { nome: 'Eng. Alice' },
      properties: [{ id: clienteA.propertyId, apelido: 'Casa principal', tipo: 'apartamento', cidade: 'Recife' }],
    });
  });

  it('cliente lendo outro cliente recebe 404', async () => {
    const cookie = await loginAs(t.app, clienteA.email, SENHA);
    const response = await get(`/api/clients/${clienteB.clientId}`, cookie);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND);
  });

  it('engenheiro A lendo cliente de B recebe 404', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await get(`/api/clients/${clienteB.clientId}`, cookie);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND);
  });

  it('admin lê qualquer cliente', async () => {
    const admin = await createUser(t.db, { role: 'admin', senha: SENHA });
    const cookie = await loginAs(t.app, admin.email, SENHA);
    expect((await get(`/api/clients/${clienteA.clientId}`, cookie)).statusCode).toBe(200);
    expect((await get(`/api/clients/${clienteB.clientId}`, cookie)).statusCode).toBe(200);
  });

  it('profissional recebe 404', async () => {
    const profissional = await createUser(t.db, { role: 'profissional', senha: SENHA });
    const cookie = await loginAs(t.app, profissional.email, SENHA);
    expect((await get(`/api/clients/${clienteA.clientId}`, cookie)).statusCode).toBe(404);
  });

  it('cliente inexistente recebe 404', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    expect((await get(`/api/clients/${randomUUID()}`, cookie)).json()).toEqual(NOT_FOUND);
  });

  it('cliente sem engenheiro mostra engenheiro null', async () => {
    await t.db.update(clients).set({ engineerId: null }).where(eq(clients.id, clienteA.clientId));
    const cookie = await loginAs(t.app, clienteA.email, SENHA);
    expect((await get(`/api/clients/${clienteA.clientId}`, cookie)).json()).toMatchObject({ engenheiro: null });
  });

  it('cliente com 2 imóveis recebe os 2 em properties, do mais antigo ao mais novo', async () => {
    await t.db.insert(properties).values({
      clientId: clienteA.clientId,
      tipo: 'empresa',
      cidade: 'Olinda',
      apelido: 'Loja',
      createdAt: new Date(Date.now() + 1000),
    });
    const cookie = await loginAs(t.app, clienteA.email, SENHA);
    const body = (await get(`/api/clients/${clienteA.clientId}`, cookie)).json<{ properties: { apelido: string }[] }>();
    expect(body.properties.map((property) => property.apelido)).toEqual(['Casa principal', 'Loja']);
  });
});

describe('GET /api/clients', () => {
  it('profissional recebe 403', async () => {
    const profissional = await createUser(t.db, { role: 'profissional', senha: SENHA });
    const cookie = await loginAs(t.app, profissional.email, SENHA);
    expect((await get('/api/clients', cookie)).statusCode).toBe(403);
  });

  it('cliente recebe 403', async () => {
    const cookie = await loginAs(t.app, clienteA.email, SENHA);
    expect((await get('/api/clients', cookie)).statusCode).toBe(403);
  });

  it('sem sessão recebe 401', async () => {
    expect((await get('/api/clients')).statusCode).toBe(401);
  });

  it('engenheiro vê só os clientes dele, com as contagens certas', async () => {
    await seedActivity(clienteA);
    await seedActivity(clienteB);
    const antigo = await createClientWithProperty(t.db, { engineerId: engA.id, nome: 'Carla Antiga' });
    await t.db
      .update(clients)
      .set({ createdAt: new Date(Date.now() - 10 * DAY_MS) })
      .where(eq(clients.id, antigo.clientId));
    const cookie = await loginAs(t.app, engA.email, SENHA);

    const response = await get('/api/clients', cookie);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      stats: { clientes: 2, solicitacoesAbertas: 1, servicosEmAndamento: 2, agendamentosAConfirmar: 1 },
      clients: [
        {
          id: clienteA.clientId,
          nome: 'Ana Souza',
          tipoImovel: 'apartamento',
          cidade: 'Recife',
          novo: true,
          servicosAtivos: 2,
          solicitacoesAbertas: 1,
        },
        {
          id: antigo.clientId,
          nome: 'Carla Antiga',
          tipoImovel: 'sobrado',
          cidade: 'Santo André',
          novo: false,
          servicosAtivos: 0,
          solicitacoesAbertas: 0,
        },
      ],
    });
  });

  it('usa o imóvel mais antigo para tipo e cidade', async () => {
    await t.db.insert(properties).values({
      clientId: clienteA.clientId,
      tipo: 'empresa',
      cidade: 'Olinda',
      apelido: 'Loja',
      createdAt: new Date(Date.now() + 1000),
    });
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const body = (await get('/api/clients', cookie)).json<{ clients: { tipoImovel: string; cidade: string }[] }>();
    expect(body.clients[0]).toMatchObject({ tipoImovel: 'apartamento', cidade: 'Recife' });
  });

  it('admin vê todos os clientes, do mais novo ao mais antigo', async () => {
    await t.db
      .update(clients)
      .set({ createdAt: new Date(Date.now() - DAY_MS) })
      .where(eq(clients.id, clienteA.clientId));
    const admin = await createUser(t.db, { role: 'admin', senha: SENHA });
    const cookie = await loginAs(t.app, admin.email, SENHA);
    const body = (await get('/api/clients', cookie)).json<{ stats: { clientes: number }; clients: { id: string }[] }>();
    expect(body.stats.clientes).toBe(2);
    expect(body.clients.map((client) => client.id)).toEqual([clienteB.clientId, clienteA.clientId]);
  });

  it('engenheiro sem clientes recebe lista vazia e contagens zeradas', async () => {
    const novo = await createEngineer(t.db, { senha: SENHA });
    const cookie = await loginAs(t.app, novo.email, SENHA);
    expect((await get('/api/clients', cookie)).json()).toEqual({
      stats: { clientes: 0, solicitacoesAbertas: 0, servicosEmAndamento: 0, agendamentosAConfirmar: 0 },
      clients: [],
    });
  });
});

describe('POST /api/clients/:id/properties', () => {
  const novoImovel = { apelido: '  Casa de praia ', tipo: 'sobrado', cidade: 'Porto de Galinhas' };

  it('engenheiro dono cria o imóvel com a planta padrão do tipo', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await post(`/api/clients/${clienteA.clientId}/properties`, cookie, novoImovel);

    expect(response.statusCode).toBe(201);
    const body = response.json<{ id: string }>();
    expect(body).toEqual({ id: body.id, apelido: 'Casa de praia', tipo: 'sobrado', cidade: 'Porto de Galinhas' });

    const [property] = await t.db.select().from(properties).where(eq(properties.id, body.id));
    expect(property!.clientId).toBe(clienteA.clientId);
    const andares = await t.db.select().from(floors).where(eq(floors.propertyId, body.id)).orderBy(asc(floors.posicao));
    expect(andares.map((andar) => andar.nome)).toEqual(floorplanFor('sobrado').map((andar) => andar.nome));
    const comodos = await t.db
      .select()
      .from(rooms)
      .where(
        inArray(
          rooms.floorId,
          andares.map((andar) => andar.id),
        ),
      );
    expect(comodos).toHaveLength(10);
    for (const andar of andares) {
      const doAndar = comodos.filter((comodo) => comodo.floorId === andar.id);
      const colisoes = doAndar.filter((a) => doAndar.some((b) => a.id !== b.id && overlaps(a, b)));
      expect(colisoes).toEqual([]);
    }
    expect(comodos.find((comodo) => comodo.nome === 'Sala de estar')).toMatchObject({ x: 0, y: 0 });
  });

  it('admin também cria', async () => {
    const admin = await createUser(t.db, { role: 'admin', senha: SENHA });
    const cookie = await loginAs(t.app, admin.email, SENHA);
    expect((await post(`/api/clients/${clienteB.clientId}/properties`, cookie, novoImovel)).statusCode).toBe(201);
  });

  it('cliente não cria imóvel: 404', async () => {
    const cookie = await loginAs(t.app, clienteA.email, SENHA);
    const response = await post(`/api/clients/${clienteA.clientId}/properties`, cookie, novoImovel);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND);
  });

  it('engenheiro de outro cliente recebe 404', async () => {
    const cookie = await loginAs(t.app, engB.email, SENHA);
    const response = await post(`/api/clients/${clienteA.clientId}/properties`, cookie, novoImovel);
    expect(response.statusCode).toBe(404);
    const total = await t.db.select().from(properties).where(eq(properties.clientId, clienteA.clientId));
    expect(total).toHaveLength(1);
  });

  it('dados inválidos respondem 400 com os campos', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await post(`/api/clients/${clienteA.clientId}/properties`, cookie, {
      apelido: '',
      tipo: 'castelo',
      cidade: '',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: {
        code: 'validation',
        fields: { apelido: 'Informe o nome.', tipo: 'Selecione o tipo de imóvel.', cidade: 'Informe a cidade.' },
      },
    });
  });

  it('identificador malformado responde 400', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    expect((await post('/api/clients/nao-e-uuid/properties', cookie, novoImovel)).statusCode).toBe(400);
  });
});
