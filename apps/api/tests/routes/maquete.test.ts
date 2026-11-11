import { and, asc, eq } from 'drizzle-orm';
import type { ApiError, Floor, Floorplan } from '@fixable/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { floors, rooms, services } from '../../src/models/index.ts';
import { insertDefaultFloorplan } from '../../src/services/property.service.ts';
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
const COLISAO = {
  error: {
    code: 'validation',
    message: 'Essa posição ou tamanho encosta em outro cômodo. Escolha outro lugar ou arraste o cômodo na planta.',
  },
};
const ANDAR_ATIVO = {
  error: {
    code: 'validation',
    message: 'Este andar tem serviços ativos. Conclua ou mova os serviços antes de excluir.',
  },
};
const COMODO_ATIVO = {
  error: {
    code: 'validation',
    message: 'Este cômodo tem serviços ativos. Conclua ou mova os serviços antes de excluir.',
  },
};
const UNICO_ANDAR = { error: { code: 'validation', message: 'O imóvel precisa ter pelo menos um andar.' } };

let t: TestApp;
let engA: { id: string; email: string };
let engB: { id: string; email: string };
let clienteA: ClientWithProperty;
let clienteB: ClientWithProperty;

beforeEach(async () => {
  t = await testApp();
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

function send(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, cookie: string, payload?: object) {
  return t.app.inject({ method, url, headers: { cookie, origin: ORIGIN }, payload });
}

async function andares(propertyId: string) {
  return t.db.select().from(floors).where(eq(floors.propertyId, propertyId)).orderBy(asc(floors.posicao));
}

async function comodo(propertyId: string, nome: string) {
  const [found] = await t.db
    .select({ id: rooms.id, nome: rooms.nome, floorId: rooms.floorId, x: rooms.x, y: rooms.y })
    .from(rooms)
    .innerJoin(floors, eq(floors.id, rooms.floorId))
    .where(and(eq(floors.propertyId, propertyId), eq(rooms.nome, nome)));
  if (!found) throw new Error(`cômodo ${nome} ausente`);
  return found;
}

async function addService(propertyId: string, roomId: string, status: 'execucao' | 'concluido') {
  const [row] = await t.db
    .insert(services)
    .values({
      propertyId,
      roomId,
      titulo: `Serviço ${status}`,
      status,
      percentual: status === 'concluido' ? 100 : 30,
      concludedAt: status === 'concluido' ? new Date() : null,
    })
    .returning({ id: services.id });
  return row!.id;
}

describe('GET /api/properties/:id/floorplan', () => {
  it('cliente vê a maquete do próprio imóvel com andares, cômodos e serviços ativos', async () => {
    const sala = await comodo(clienteA.propertyId, 'Sala de estar');
    const servicoId = await addService(clienteA.propertyId, sala.id, 'execucao');
    const cookie = await loginAs(t.app, clienteA.email, SENHA);
    const response = await send('GET', `/api/properties/${clienteA.propertyId}/floorplan`, cookie);
    expect(response.statusCode).toBe(200);
    const body = response.json<Floorplan>();
    expect(body.floors.map((floor) => floor.nome)).toEqual(['Andar 1', 'Andar 2']);
    expect(body.floors[0]!.posicao).toBe(0);
    expect(body.floors[0]!.rooms[0]).toEqual({ id: sala.id, nome: 'Sala de estar', x: 0, y: 0, largura: 3, altura: 2 });
    expect(body.floors[0]!.rooms).toHaveLength(5);
    expect(body.services).toEqual([
      {
        id: servicoId,
        roomId: sala.id,
        titulo: 'Serviço execucao',
        descricao: null,
        status: 'execucao',
        prazo: null,
        percentual: 30,
        concludedAt: null,
      },
    ]);
  });

  it('engenheiro dono e admin leem; engenheiro de outro cliente, outro cliente e profissional recebem 404', async () => {
    const admin = await createUser(t.db, { role: 'admin', senha: SENHA });
    const profissional = await createUser(t.db, { role: 'profissional', senha: SENHA });
    const url = `/api/properties/${clienteA.propertyId}/floorplan`;
    expect((await send('GET', url, await loginAs(t.app, engA.email, SENHA))).statusCode).toBe(200);
    expect((await send('GET', url, await loginAs(t.app, admin.email, SENHA))).statusCode).toBe(200);
    for (const email of [engB.email, clienteB.email, profissional.email]) {
      const response = await send('GET', url, await loginAs(t.app, email, SENHA));
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
    }
  });

  it('sem sessão responde 401', async () => {
    const response = await t.app.inject({ method: 'GET', url: `/api/properties/${clienteA.propertyId}/floorplan` });
    expect(response.statusCode).toBe(401);
  });
});

describe('andares', () => {
  it('engenheiro adiciona andar com o nome padrão "Andar {n+1}" e a próxima posição', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('POST', `/api/properties/${clienteA.propertyId}/floors`, cookie);
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ nome: 'Andar 3', posicao: 2, rooms: [] });
    const nomeado = await send('POST', `/api/properties/${clienteA.propertyId}/floors`, cookie, { nome: 'Cobertura' });
    expect(nomeado.json()).toMatchObject({ nome: 'Cobertura', posicao: 3 });
  });

  it('cliente e engenheiro de outro cliente recebem 404 ao adicionar andar', async () => {
    for (const email of [clienteA.email, engB.email]) {
      const response = await send('POST', `/api/properties/${clienteA.propertyId}/floors`, await loginAs(t.app, email, SENHA));
      expect(response.statusCode).toBe(404);
    }
    expect(await andares(clienteA.propertyId)).toHaveLength(2);
  });

  it('engenheiro renomeia o andar; nome vazio é recusado', async () => {
    const [primeiro] = await andares(clienteA.propertyId);
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('PATCH', `/api/floors/${primeiro!.id}`, cookie, { nome: 'Térreo' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: primeiro!.id, nome: 'Térreo', posicao: 0 });
    expect(response.json<Floor>().rooms).toHaveLength(5);
    const vazio = await send('PATCH', `/api/floors/${primeiro!.id}`, cookie, { nome: '  ' });
    expect(vazio.statusCode).toBe(400);
  });

  it('renomear andar de outro cliente ou como cliente responde 404', async () => {
    const [primeiro] = await andares(clienteA.propertyId);
    for (const email of [clienteA.email, engB.email]) {
      const cookie = await loginAs(t.app, email, SENHA);
      const response = await send('PATCH', `/api/floors/${primeiro!.id}`, cookie, { nome: 'Térreo' });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
    }
  });

  it('excluir andar com serviço ativo responde 400', async () => {
    const sala = await comodo(clienteA.propertyId, 'Sala de estar');
    await addService(clienteA.propertyId, sala.id, 'execucao');
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('DELETE', `/api/floors/${sala.floorId}`, cookie);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(ANDAR_ATIVO);
    expect(await andares(clienteA.propertyId)).toHaveLength(2);
  });

  it('excluir andar sem serviço ativo remove andar e cômodos', async () => {
    const sala = await comodo(clienteA.propertyId, 'Sala de estar');
    await addService(clienteA.propertyId, sala.id, 'concluido');
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('DELETE', `/api/floors/${sala.floorId}`, cookie);
    expect(response.statusCode).toBe(204);
    expect((await andares(clienteA.propertyId)).map((floor) => floor.nome)).toEqual(['Andar 2']);
    expect(await t.db.select().from(rooms).where(eq(rooms.floorId, sala.floorId))).toEqual([]);
  });

  it('excluir o único andar responde 400', async () => {
    const [unico] = await andares(clienteB.propertyId);
    const cookie = await loginAs(t.app, engB.email, SENHA);
    const response = await send('DELETE', `/api/floors/${unico!.id}`, cookie);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(UNICO_ANDAR);
  });

  it('excluir andar como cliente ou engenheiro de outro cliente responde 404', async () => {
    const [primeiro] = await andares(clienteA.propertyId);
    for (const email of [clienteA.email, engB.email]) {
      const response = await send('DELETE', `/api/floors/${primeiro!.id}`, await loginAs(t.app, email, SENHA));
      expect(response.statusCode).toBe(404);
    }
    expect(await andares(clienteA.propertyId)).toHaveLength(2);
  });

  it('andar inexistente responde 404', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('PATCH', '/api/floors/3f2b8c1e-5a47-4d6e-9b1a-0c7d2e4f6a81', cookie, { nome: 'X' });
    expect(response.statusCode).toBe(404);
  });
});

describe('POST /api/floors/:id/rooms', () => {
  it('cômodo sem posição vai para o primeiro espaço livre', async () => {
    const [primeiro] = await andares(clienteA.propertyId);
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('POST', `/api/floors/${primeiro!.id}/rooms`, cookie, {
      nome: 'Quarto 3',
      largura: 2,
      altura: 1,
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ nome: 'Quarto 3', x: 0, y: 2, largura: 2, altura: 1 });
  });

  it('cômodo com posição livre usa a posição pedida', async () => {
    const [primeiro] = await andares(clienteA.propertyId);
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('POST', `/api/floors/${primeiro!.id}/rooms`, cookie, {
      nome: 'Depósito',
      largura: 1,
      altura: 1,
      x: 4,
      y: 3,
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ x: 4, y: 3 });
  });

  it('posição sobreposta ou que passa da sexta coluna é recusada', async () => {
    const [primeiro] = await andares(clienteA.propertyId);
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const url = `/api/floors/${primeiro!.id}/rooms`;
    const sobreposto = await send('POST', url, cookie, { nome: 'Closet', largura: 1, altura: 1, x: 1, y: 1 });
    expect(sobreposto.statusCode).toBe(400);
    expect(sobreposto.json()).toEqual(COLISAO);
    const fora = await send('POST', url, cookie, { nome: 'Closet', largura: 2, altura: 1, x: 5, y: 4 });
    expect(fora.statusCode).toBe(400);
    expect(fora.json()).toEqual(COLISAO);
  });

  it('largura acima de 4 é recusada pela validação', async () => {
    const [primeiro] = await andares(clienteA.propertyId);
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('POST', `/api/floors/${primeiro!.id}/rooms`, cookie, { nome: 'Salão', largura: 5, altura: 1 });
    expect(response.statusCode).toBe(400);
    expect(response.json<ApiError>().error.code).toBe('validation');
  });

  it('cliente e engenheiro de outro cliente recebem 404', async () => {
    const [primeiro] = await andares(clienteA.propertyId);
    for (const email of [clienteA.email, engB.email]) {
      const cookie = await loginAs(t.app, email, SENHA);
      const response = await send('POST', `/api/floors/${primeiro!.id}/rooms`, cookie, { nome: 'X', largura: 1, altura: 1 });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
    }
  });
});

describe('PATCH /api/rooms/:id', () => {
  it('cômodo movido para uma posição que encosta em outro é recusado com a mensagem do modelo', async () => {
    const lavabo = await comodo(clienteA.propertyId, 'Lavabo');
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('PATCH', `/api/rooms/${lavabo.id}`, cookie, {
      nome: 'Lavabo',
      largura: 1,
      altura: 1,
      x: 4,
      y: 0,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(COLISAO);
    expect(await comodo(clienteA.propertyId, 'Lavabo')).toMatchObject({ x: 5, y: 0 });
  });

  it('aumentar a largura além da sexta coluna é recusado', async () => {
    const lavabo = await comodo(clienteA.propertyId, 'Lavabo');
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('PATCH', `/api/rooms/${lavabo.id}`, cookie, { nome: 'Lavabo', largura: 2, altura: 1 });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(COLISAO);
  });

  it('mover para um espaço livre encostado na borda de outro é aceito', async () => {
    const lavabo = await comodo(clienteA.propertyId, 'Lavabo');
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('PATCH', `/api/rooms/${lavabo.id}`, cookie, {
      nome: 'Lavabo social',
      largura: 2,
      altura: 1,
      x: 0,
      y: 2,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: lavabo.id, nome: 'Lavabo social', x: 0, y: 2, largura: 2, altura: 1 });
  });

  it('sem coluna e linha mantém a posição atual', async () => {
    const cozinha = await comodo(clienteA.propertyId, 'Cozinha');
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('PATCH', `/api/rooms/${cozinha.id}`, cookie, { nome: 'Cozinha gourmet', largura: 2, altura: 1 });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ nome: 'Cozinha gourmet', x: 3, y: 0 });
  });

  it('cliente e engenheiro de outro cliente recebem 404', async () => {
    const lavabo = await comodo(clienteA.propertyId, 'Lavabo');
    for (const email of [clienteA.email, engB.email]) {
      const cookie = await loginAs(t.app, email, SENHA);
      const response = await send('PATCH', `/api/rooms/${lavabo.id}`, cookie, { nome: 'X', largura: 1, altura: 1 });
      expect(response.statusCode).toBe(404);
    }
  });
});

describe('DELETE /api/rooms/:id', () => {
  it('excluir cômodo com serviço ativo responde 400', async () => {
    const sala = await comodo(clienteA.propertyId, 'Sala de estar');
    await addService(clienteA.propertyId, sala.id, 'execucao');
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('DELETE', `/api/rooms/${sala.id}`, cookie);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(COMODO_ATIVO);
  });

  it('excluir cômodo sem serviço ativo responde 204', async () => {
    const garagem = await comodo(clienteA.propertyId, 'Garagem');
    await addService(clienteA.propertyId, garagem.id, 'concluido');
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('DELETE', `/api/rooms/${garagem.id}`, cookie);
    expect(response.statusCode).toBe(204);
    expect(await t.db.select().from(rooms).where(eq(rooms.id, garagem.id))).toEqual([]);
  });

  it('cliente e engenheiro de outro cliente recebem 404', async () => {
    const garagem = await comodo(clienteA.propertyId, 'Garagem');
    for (const email of [clienteA.email, engB.email]) {
      const response = await send('DELETE', `/api/rooms/${garagem.id}`, await loginAs(t.app, email, SENHA));
      expect(response.statusCode).toBe(404);
    }
    expect(await t.db.select().from(rooms).where(eq(rooms.id, garagem.id))).toHaveLength(1);
  });
});
