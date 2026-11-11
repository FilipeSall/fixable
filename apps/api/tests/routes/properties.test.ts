import { asc, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { propertyAttributes } from '../../src/models/index.ts';
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
const DUPLICADA = { error: { code: 'validation', message: 'Já existe uma informação com esse nome. Edite a existente.' } };

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
  clienteA = await createClientWithProperty(t.db, { engineerId: engA.id, senha: SENHA });
  clienteB = await createClientWithProperty(t.db, { engineerId: engB.id, senha: SENHA });
});
afterEach(async () => {
  await t.close();
});

const atributos = (propertyId: string) => `/api/properties/${propertyId}/attributes`;
const atributo = (propertyId: string, attrId: string) => `/api/properties/${propertyId}/attributes/${attrId}`;

function send(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, cookie: string, payload?: object) {
  return t.app.inject({ method, url, headers: { cookie, origin: ORIGIN }, payload });
}

async function seedAttributes(propertyId: string, rows: [string, string][]) {
  return t.db
    .insert(propertyAttributes)
    .values(rows.map(([chave, valor], posicao) => ({ propertyId, chave, valor, posicao })))
    .returning({ id: propertyAttributes.id });
}

async function chaves(propertyId: string) {
  const rows = await t.db
    .select()
    .from(propertyAttributes)
    .where(eq(propertyAttributes.propertyId, propertyId))
    .orderBy(asc(propertyAttributes.posicao));
  return rows.map((row) => [row.chave, row.valor]);
}

describe('GET /api/properties/:id/attributes', () => {
  it('cliente lê os dados do próprio imóvel na ordem', async () => {
    const [cidade, tipo] = await seedAttributes(clienteA.propertyId, [
      ['Cidade', 'Recife'],
      ['Tipo de imóvel', 'Sobrado'],
    ]);
    const cookie = await loginAs(t.app, clienteA.email, SENHA);
    const response = await send('GET', atributos(clienteA.propertyId), cookie);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      { id: cidade!.id, chave: 'Cidade', valor: 'Recife' },
      { id: tipo!.id, chave: 'Tipo de imóvel', valor: 'Sobrado' },
    ]);
  });

  it('cliente lendo o imóvel de outro recebe 404', async () => {
    const cookie = await loginAs(t.app, clienteA.email, SENHA);
    const response = await send('GET', atributos(clienteB.propertyId), cookie);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND);
  });

  it('engenheiro A lendo imóvel de cliente de B recebe 404', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    expect((await send('GET', atributos(clienteB.propertyId), cookie)).statusCode).toBe(404);
  });

  it('imóvel inexistente recebe 404', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    expect((await send('GET', atributos(randomUUID()), cookie)).json()).toEqual(NOT_FOUND);
  });

  it('sem sessão recebe 401', async () => {
    expect((await t.app.inject({ method: 'GET', url: atributos(clienteA.propertyId) })).statusCode).toBe(401);
  });
});

describe('POST /api/properties/:id/attributes', () => {
  it('engenheiro dono adiciona no fim da lista', async () => {
    await seedAttributes(clienteA.propertyId, [['Cidade', 'Recife']]);
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('POST', atributos(clienteA.propertyId), cookie, {
      chave: ' Área construída ',
      valor: '180 m²',
    });
    expect(response.statusCode).toBe(201);
    const body = response.json<{ id: string }>();
    expect(body).toEqual({ id: body.id, chave: 'Área construída', valor: '180 m²' });
    expect(await chaves(clienteA.propertyId)).toEqual([
      ['Cidade', 'Recife'],
      ['Área construída', '180 m²'],
    ]);
  });

  it('admin também adiciona', async () => {
    const admin = await createUser(t.db, { role: 'admin', senha: SENHA });
    const cookie = await loginAs(t.app, admin.email, SENHA);
    const response = await send('POST', atributos(clienteB.propertyId), cookie, { chave: 'Andares', valor: '2' });
    expect(response.statusCode).toBe(201);
  });

  it('cliente tentando adicionar no próprio imóvel recebe 404', async () => {
    const cookie = await loginAs(t.app, clienteA.email, SENHA);
    const response = await send('POST', atributos(clienteA.propertyId), cookie, { chave: 'Andares', valor: '2' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND);
    expect(await chaves(clienteA.propertyId)).toEqual([]);
  });

  it('engenheiro A escrevendo em cliente de B recebe 404', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('POST', atributos(clienteB.propertyId), cookie, { chave: 'Andares', valor: '2' });
    expect(response.statusCode).toBe(404);
    expect(await chaves(clienteB.propertyId)).toEqual([]);
  });

  it('chave duplicada, sem diferenciar maiúsculas, responde 400', async () => {
    await seedAttributes(clienteA.propertyId, [['Cidade', 'Recife']]);
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('POST', atributos(clienteA.propertyId), cookie, { chave: 'cidade', valor: 'Olinda' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(DUPLICADA);
  });

  it('a mesma chave em outro imóvel é permitida', async () => {
    await seedAttributes(clienteB.propertyId, [['Cidade', 'Recife']]);
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('POST', atributos(clienteA.propertyId), cookie, { chave: 'Cidade', valor: 'Olinda' });
    expect(response.statusCode).toBe(201);
  });

  it('campos vazios respondem 400 com a mensagem fixa', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('POST', atributos(clienteA.propertyId), cookie, { chave: ' ', valor: '' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: {
        code: 'validation',
        fields: { chave: 'Preencha a informação e o valor.', valor: 'Preencha a informação e o valor.' },
      },
    });
  });
});

describe('PATCH /api/properties/:id/attributes/:attrId', () => {
  it('engenheiro dono edita chave e valor', async () => {
    const [cidade] = await seedAttributes(clienteA.propertyId, [
      ['Cidade', 'Recife'],
      ['Andares', '1'],
    ]);
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('PATCH', atributo(clienteA.propertyId, cidade!.id), cookie, {
      chave: 'Município',
      valor: 'Olinda',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: cidade!.id, chave: 'Município', valor: 'Olinda' });
    expect(await chaves(clienteA.propertyId)).toEqual([
      ['Município', 'Olinda'],
      ['Andares', '1'],
    ]);
  });

  it('manter a própria chave mudando só o valor é permitido', async () => {
    const [cidade] = await seedAttributes(clienteA.propertyId, [['Cidade', 'Recife']]);
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('PATCH', atributo(clienteA.propertyId, cidade!.id), cookie, {
      chave: 'CIDADE',
      valor: 'Olinda',
    });
    expect(response.statusCode).toBe(200);
  });

  it('renomear para uma chave que já existe responde 400', async () => {
    const [, andares] = await seedAttributes(clienteA.propertyId, [
      ['Cidade', 'Recife'],
      ['Andares', '1'],
    ]);
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('PATCH', atributo(clienteA.propertyId, andares!.id), cookie, {
      chave: 'Cidade',
      valor: 'x',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(DUPLICADA);
  });

  it('atributo de outro imóvel responde 404', async () => {
    const [doB] = await seedAttributes(clienteB.propertyId, [['Cidade', 'Recife']]);
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('PATCH', atributo(clienteA.propertyId, doB!.id), cookie, {
      chave: 'Cidade',
      valor: 'Olinda',
    });
    expect(response.statusCode).toBe(404);
    expect(await chaves(clienteB.propertyId)).toEqual([['Cidade', 'Recife']]);
  });

  it('cliente editando o próprio imóvel recebe 404', async () => {
    const [cidade] = await seedAttributes(clienteA.propertyId, [['Cidade', 'Recife']]);
    const cookie = await loginAs(t.app, clienteA.email, SENHA);
    const response = await send('PATCH', atributo(clienteA.propertyId, cidade!.id), cookie, {
      chave: 'Cidade',
      valor: 'Olinda',
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('DELETE /api/properties/:id/attributes/:attrId', () => {
  it('engenheiro dono remove o atributo', async () => {
    const [cidade] = await seedAttributes(clienteA.propertyId, [
      ['Cidade', 'Recife'],
      ['Andares', '1'],
    ]);
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('DELETE', atributo(clienteA.propertyId, cidade!.id), cookie);
    expect(response.statusCode).toBe(204);
    expect(await chaves(clienteA.propertyId)).toEqual([['Andares', '1']]);
  });

  it('cliente removendo recebe 404 e nada muda', async () => {
    const [cidade] = await seedAttributes(clienteA.propertyId, [['Cidade', 'Recife']]);
    const cookie = await loginAs(t.app, clienteA.email, SENHA);
    expect((await send('DELETE', atributo(clienteA.propertyId, cidade!.id), cookie)).statusCode).toBe(404);
    expect(await chaves(clienteA.propertyId)).toEqual([['Cidade', 'Recife']]);
  });

  it('engenheiro de outro cliente recebe 404', async () => {
    const [cidade] = await seedAttributes(clienteA.propertyId, [['Cidade', 'Recife']]);
    const cookie = await loginAs(t.app, engB.email, SENHA);
    expect((await send('DELETE', atributo(clienteA.propertyId, cidade!.id), cookie)).statusCode).toBe(404);
  });

  it('atributo inexistente recebe 404', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const response = await send('DELETE', atributo(clienteA.propertyId, randomUUID()), cookie);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND);
  });
});
