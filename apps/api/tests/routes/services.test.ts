import { and, eq } from 'drizzle-orm';
import type { Floorplan, HistoryItem, Service } from '@fixable/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { floors, rooms, services } from '../../src/models/index.ts';
import { insertDefaultFloorplan } from '../../src/services/property.service.ts';
import {
  createClientWithProperty,
  createEngineer,
  loginAs,
  resetDb,
  testApp,
  type ClientWithProperty,
  type TestApp,
} from '../helpers.ts';

const ORIGIN = 'http://localhost:4321';
const SENHA = 'senha-forte-123';
const NOT_FOUND = { error: { code: 'not_found', message: 'Recurso não encontrado.' } };
const COMODO_INVALIDO = { error: { code: 'validation', message: 'Selecione um cômodo deste imóvel.' } };
const HORA = 60 * 60 * 1000;
const INICIO = new Date('2026-11-10T12:00:00.000Z');

let t: TestApp;
let agora: Date;
let engA: { id: string; email: string };
let engB: { id: string; email: string };
let clienteA: ClientWithProperty;
let clienteB: ClientWithProperty;

beforeEach(async () => {
  agora = INICIO;
  t = await testApp({}, { clock: () => agora });
  await t.app.ready();
  await resetDb(t.db);
  engA = await createEngineer(t.db, { senha: SENHA });
  engB = await createEngineer(t.db, { senha: SENHA });
  clienteA = await createClientWithProperty(t.db, { engineerId: engA.id, senha: SENHA, tipo: 'sobrado' });
  clienteB = await createClientWithProperty(t.db, { engineerId: engB.id, senha: SENHA, tipo: 'apartamento' });
  await t.db.transaction(async (tx) => {
    await insertDefaultFloorplan(tx, clienteA.propertyId, 'sobrado');
    await insertDefaultFloorplan(tx, clienteB.propertyId, 'apartamento');
  });
});
afterEach(async () => {
  await t.close();
});

function send(method: 'GET' | 'POST' | 'PATCH', url: string, cookie: string, payload?: object) {
  return t.app.inject({ method, url, headers: { cookie, origin: ORIGIN }, payload });
}

async function comodo(propertyId: string, nome: string) {
  const [found] = await t.db
    .select({ id: rooms.id })
    .from(rooms)
    .innerJoin(floors, eq(floors.id, rooms.floorId))
    .where(and(eq(floors.propertyId, propertyId), eq(rooms.nome, nome)));
  if (!found) throw new Error(`cômodo ${nome} ausente`);
  return found.id;
}

async function criarServico(cookie: string, payload: object = {}) {
  const roomId = await comodo(clienteA.propertyId, 'Cozinha');
  return send('POST', `/api/properties/${clienteA.propertyId}/services`, cookie, {
    roomId,
    titulo: 'Trocar torneira do tanque',
    descricao: 'Vazamento na base',
    status: 'atencao',
    prazo: '2026-12-01',
    percentual: 20,
    ...payload,
  });
}

async function criarId(cookie: string, payload: object = {}) {
  return (await criarServico(cookie, payload)).json<Service>().id;
}

async function linha(id: string) {
  const [row] = await t.db.select().from(services).where(eq(services.id, id));
  return row!;
}

describe('POST /api/properties/:id/services', () => {
  it('engenheiro cria serviço no cômodo do imóvel', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await criarServico(cookie);
    expect(response.statusCode).toBe(201);
    const criado = response.json<Service>();
    expect(criado).toEqual({
      id: criado.id,
      roomId: await comodo(clienteA.propertyId, 'Cozinha'),
      titulo: 'Trocar torneira do tanque',
      descricao: 'Vazamento na base',
      status: 'atencao',
      prazo: '2026-12-01',
      percentual: 20,
      concludedAt: null,
    });
    expect((await linha(criado.id)).propertyId).toBe(clienteA.propertyId);
  });

  it('criar já concluído grava a conclusão e 100%', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await criarServico(cookie, { status: 'concluido', percentual: 40 });
    expect(response.json()).toMatchObject({ status: 'concluido', percentual: 100, concludedAt: INICIO.toISOString() });
  });

  it('roomId de outro imóvel responde 400', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await criarServico(cookie, { roomId: await comodo(clienteB.propertyId, 'Sala') });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(COMODO_INVALIDO);
    expect(await t.db.select().from(services)).toEqual([]);
  });

  it('cliente e engenheiro de outro cliente recebem 404', async () => {
    for (const email of [clienteA.email, engB.email]) {
      const response = await criarServico(await loginAs(t.app, email, SENHA));
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
    }
    expect(await t.db.select().from(services)).toEqual([]);
  });
});

describe('PATCH /api/services/:id', () => {
  it('mudar o status para concluído grava concluded_at e percentual 100', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const id = await criarId(cookie);
    agora = new Date(INICIO.getTime() + 2 * HORA);
    const response = await send('PATCH', `/api/services/${id}`, cookie, { status: 'concluido' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'concluido', percentual: 100, concludedAt: agora.toISOString() });
    expect((await linha(id)).concludedAt).toEqual(agora);
  });

  it('reabrir um serviço concluído limpa a conclusão', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const id = await criarId(cookie, { status: 'concluido' });
    const response = await send('PATCH', `/api/services/${id}`, cookie, { status: 'execucao', percentual: 60 });
    expect(response.json()).toMatchObject({ status: 'execucao', percentual: 60, concludedAt: null });
  });

  it('descricao null ou vazia limpa; ausente mantém', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const id = await criarId(cookie);
    const mantida = await send('PATCH', `/api/services/${id}`, cookie, { titulo: 'Trocar torneira' });
    expect(mantida.json()).toMatchObject({ titulo: 'Trocar torneira', descricao: 'Vazamento na base' });
    const nula = await send('PATCH', `/api/services/${id}`, cookie, { descricao: null, prazo: null });
    expect(nula.json()).toMatchObject({ descricao: null, prazo: null });
    await send('PATCH', `/api/services/${id}`, cookie, { descricao: 'De novo' });
    const vazia = await send('PATCH', `/api/services/${id}`, cookie, { descricao: '' });
    expect(vazia.json<Service>().descricao).toBeNull();
    expect((await linha(id)).descricao).toBeNull();
  });

  it('mover para cômodo de outro imóvel responde 400; para outro cômodo do mesmo imóvel é aceito', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const id = await criarId(cookie);
    const fora = await send('PATCH', `/api/services/${id}`, cookie, { roomId: await comodo(clienteB.propertyId, 'Sala') });
    expect(fora.statusCode).toBe(400);
    expect(fora.json()).toEqual(COMODO_INVALIDO);
    const suite = await comodo(clienteA.propertyId, 'Suíte');
    const dentro = await send('PATCH', `/api/services/${id}`, cookie, { roomId: suite });
    expect(dentro.json<Service>().roomId).toBe(suite);
  });

  it('cliente e engenheiro de outro cliente recebem 404', async () => {
    const id = await criarId(await loginAs(t.app, engA.email, SENHA));
    for (const email of [clienteA.email, engB.email]) {
      const response = await send('PATCH', `/api/services/${id}`, await loginAs(t.app, email, SENHA), { titulo: 'X' });
      expect(response.statusCode).toBe(404);
    }
    expect((await linha(id)).titulo).toBe('Trocar torneira do tanque');
  });
});

describe('POST /api/services/:id/complete', () => {
  it('conclui e é idempotente: a segunda chamada mantém a data da primeira', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const id = await criarId(cookie);
    agora = new Date(INICIO.getTime() + HORA);
    const primeira = await send('POST', `/api/services/${id}/complete`, cookie);
    expect(primeira.statusCode).toBe(200);
    expect(primeira.json()).toMatchObject({ status: 'concluido', percentual: 100, concludedAt: agora.toISOString() });
    const concluidoEm = agora.toISOString();
    agora = new Date(INICIO.getTime() + 3 * HORA);
    const segunda = await send('POST', `/api/services/${id}/complete`, cookie);
    expect(segunda.statusCode).toBe(200);
    expect(segunda.json<Service>().concludedAt).toBe(concluidoEm);
  });

  it('cliente e engenheiro de outro cliente recebem 404', async () => {
    const id = await criarId(await loginAs(t.app, engA.email, SENHA));
    for (const email of [clienteA.email, engB.email]) {
      const response = await send('POST', `/api/services/${id}/complete`, await loginAs(t.app, email, SENHA));
      expect(response.statusCode).toBe(404);
    }
    expect((await linha(id)).status).toBe('atencao');
  });
});

describe('regra das 24 h e histórico', () => {
  it('concluído há 23 h aparece em andamento; há 25 h some; os dois ficam no histórico', async () => {
    const eng = await loginAs(t.app, engA.email, SENHA);
    const recente = await criarId(eng, { titulo: 'Recente' });
    const antigo = await criarId(eng, { titulo: 'Antigo' });
    const ativo = await criarId(eng, { titulo: 'Ativo' });
    await send('POST', `/api/services/${antigo}/complete`, eng);
    agora = new Date(INICIO.getTime() + 2 * HORA);
    await send('POST', `/api/services/${recente}/complete`, eng);
    agora = new Date(INICIO.getTime() + 25 * HORA);

    const cliente = await loginAs(t.app, clienteA.email, SENHA);
    const maquete = await send('GET', `/api/properties/${clienteA.propertyId}/floorplan`, cliente);
    const visiveis = maquete.json<Floorplan>().services.map((service) => service.id);
    expect(visiveis).toContain(recente);
    expect(visiveis).toContain(ativo);
    expect(visiveis).not.toContain(antigo);

    const historico = await send('GET', `/api/properties/${clienteA.propertyId}/history`, cliente);
    expect(historico.statusCode).toBe(200);
    expect(historico.json<HistoryItem[]>()).toEqual([
      {
        id: recente,
        titulo: 'Recente',
        descricao: 'Vazamento na base',
        andar: 'Andar 1',
        comodo: 'Cozinha',
        concludedAt: new Date(INICIO.getTime() + 2 * HORA).toISOString(),
      },
      {
        id: antigo,
        titulo: 'Antigo',
        descricao: 'Vazamento na base',
        andar: 'Andar 1',
        comodo: 'Cozinha',
        concludedAt: INICIO.toISOString(),
      },
    ]);
  });

  it('histórico de outro cliente responde 404 para engenheiro e cliente alheios', async () => {
    for (const email of [clienteB.email, engB.email]) {
      const response = await send('GET', `/api/properties/${clienteA.propertyId}/history`, await loginAs(t.app, email, SENHA));
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
    }
  });
});
