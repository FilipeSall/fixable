import { eq } from 'drizzle-orm';
import type { Appointment } from '@fixable/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appointments, emailOutbox, properties } from '../../src/models/index.ts';
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
let segundoImovelA: string;

beforeEach(async () => {
  t = await testApp();
  await t.app.ready();
  await resetDb(t.db);
  engA = await createEngineer(t.db, { senha: SENHA });
  engB = await createEngineer(t.db, { senha: SENHA });
  admin = await createUser(t.db, { role: 'admin', senha: SENHA });
  profissional = await createUser(t.db, { role: 'profissional', senha: SENHA });
  clienteA = await createClientWithProperty(t.db, {
    engineerId: engA.id,
    senha: SENHA,
    nome: 'Marina Souza',
    email: 'marina@cliente.test',
    apelido: 'Casa principal',
  });
  clienteB = await createClientWithProperty(t.db, { engineerId: engB.id, senha: SENHA });
  const [segundo] = await t.db
    .insert(properties)
    .values({ clientId: clienteA.clientId, tipo: 'apartamento', cidade: 'Santos', apelido: 'Apartamento da praia' })
    .returning({ id: properties.id });
  segundoImovelA = segundo!.id;
});
afterEach(async () => {
  await t.close();
});

function send(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, cookie: string, payload?: object) {
  return t.app.inject({ method, url, headers: { cookie, origin: ORIGIN }, payload });
}

function criar(cookie: string, payload: object = {}, clientId = clienteA.clientId) {
  return send('POST', `/api/clients/${clientId}/appointments`, cookie, {
    propertyId: clienteA.propertyId,
    servico: 'Revisão elétrica',
    data: '2026-11-20',
    hora: '09:30',
    status: 'pendente',
    descricao: 'Trocar o disjuntor geral',
    ...payload,
  });
}

async function semear(p: { data: string; hora: string; servico?: string; propertyId?: string; clientId?: string }) {
  const [row] = await t.db
    .insert(appointments)
    .values({
      clientId: p.clientId ?? clienteA.clientId,
      propertyId: p.propertyId ?? clienteA.propertyId,
      servico: p.servico ?? `Visita ${p.data} ${p.hora}`,
      data: p.data,
      hora: p.hora,
      status: 'confirmado',
    })
    .returning({ id: appointments.id });
  return row!.id;
}

async function linha(id: string) {
  const [row] = await t.db.select().from(appointments).where(eq(appointments.id, id));
  return row;
}

function emails() {
  return t.db.select().from(emailOutbox);
}

describe('GET /api/clients/:id/appointments', () => {
  it('lista só os do mês, por data e hora', async () => {
    await semear({ data: '2026-10-31', hora: '23:00' });
    const tarde = await semear({ data: '2026-11-05', hora: '14:00', servico: 'Pintura' });
    const manha = await semear({ data: '2026-11-05', hora: '08:00', servico: 'Hidráulica' });
    const primeiro = await semear({ data: '2026-11-01', hora: '10:00', propertyId: segundoImovelA });
    const ultimo = await semear({ data: '2026-11-30', hora: '18:00' });
    await semear({ data: '2026-12-01', hora: '07:00' });
    await semear({ data: '2026-11-10', hora: '10:00', clientId: clienteB.clientId, propertyId: clienteB.propertyId });
    const cookie = await loginAs(t.app, clienteA.email, SENHA);
    const response = await send('GET', `/api/clients/${clienteA.clientId}/appointments?mes=2026-11`, cookie);
    expect(response.statusCode).toBe(200);
    const lista = response.json<Appointment[]>();
    expect(lista.map((item) => item.id)).toEqual([primeiro, manha, tarde, ultimo]);
    expect(lista[1]).toEqual({
      id: manha,
      propertyId: clienteA.propertyId,
      propertyApelido: 'Casa principal',
      servico: 'Hidráulica',
      data: '2026-11-05',
      hora: '08:00',
      status: 'confirmado',
      descricao: null,
    });
  });

  it('filtra pelo imóvel', async () => {
    await semear({ data: '2026-11-05', hora: '08:00' });
    const praia = await semear({ data: '2026-11-06', hora: '08:00', propertyId: segundoImovelA });
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const url = `/api/clients/${clienteA.clientId}/appointments?mes=2026-11&propertyId=${segundoImovelA}`;
    const response = await send('GET', url, cookie);
    expect(response.statusCode).toBe(200);
    expect(response.json<Appointment[]>()).toEqual([
      expect.objectContaining({ id: praia, propertyApelido: 'Apartamento da praia' }),
    ]);
  });

  it('dezembro inclui o dia 31 e não vaza para janeiro', async () => {
    const reveillon = await semear({ data: '2026-12-31', hora: '23:59' });
    await semear({ data: '2027-01-01', hora: '00:00' });
    const cookie = await loginAs(t.app, admin.email, SENHA);
    const response = await send('GET', `/api/clients/${clienteA.clientId}/appointments?mes=2026-12`, cookie);
    expect(response.json<Appointment[]>().map((item) => item.id)).toEqual([reveillon]);
  });

  it('mês ausente ou inválido responde 400', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    for (const query of ['', '?mes=2026-13', '?mes=11-2026']) {
      const response = await send('GET', `/api/clients/${clienteA.clientId}/appointments${query}`, cookie);
      expect(response.statusCode).toBe(400);
    }
  });

  it('engenheiro de outro, outro cliente e profissional recebem 404; sem sessão 401', async () => {
    const url = `/api/clients/${clienteA.clientId}/appointments?mes=2026-11`;
    for (const email of [engB.email, clienteB.email, profissional.email]) {
      const response = await send('GET', url, await loginAs(t.app, email, SENHA));
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
    }
    expect((await t.app.inject({ method: 'GET', url })).statusCode).toBe(401);
  });
});

describe('POST /api/clients/:id/appointments', () => {
  it('engenheiro dono cria e enfileira o e-mail ao cliente na mesma transação', async () => {
    const response = await criar(await loginAs(t.app, engA.email, SENHA));
    expect(response.statusCode).toBe(201);
    const criado = response.json<Appointment>();
    expect(criado).toEqual({
      id: criado.id,
      propertyId: clienteA.propertyId,
      propertyApelido: 'Casa principal',
      servico: 'Revisão elétrica',
      data: '2026-11-20',
      hora: '09:30',
      status: 'pendente',
      descricao: 'Trocar o disjuntor geral',
    });
    expect((await linha(criado.id))?.clientId).toBe(clienteA.clientId);
    const fila = await emails();
    expect(fila).toHaveLength(1);
    expect(fila[0]).toMatchObject({
      to: 'marina@cliente.test',
      template: 'agendamento',
      emailTokenId: null,
      data: {
        nome: 'Marina Souza',
        acao: 'criado',
        servico: 'Revisão elétrica',
        imovel: 'Casa principal',
        data: '20/11/2026',
        hora: '09:30',
        status: 'Pendente · requer confirmação',
        link: 'http://localhost:4321/app/cliente',
      },
    });
  });

  it('admin cria em outro imóvel do cliente', async () => {
    const response = await criar(await loginAs(t.app, admin.email, SENHA), { propertyId: segundoImovelA });
    expect(response.statusCode).toBe(201);
    expect(response.json<Appointment>().propertyApelido).toBe('Apartamento da praia');
    expect(await emails()).toHaveLength(1);
  });

  it('imóvel de outro cliente responde 400, sem agendamento e sem e-mail', async () => {
    const response = await criar(await loginAs(t.app, engA.email, SENHA), { propertyId: clienteB.propertyId });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(IMOVEL_INVALIDO);
    expect(await t.db.select().from(appointments)).toHaveLength(0);
    expect(await emails()).toHaveLength(0);
  });

  it('cliente, engenheiro de outro e profissional recebem 404, sem e-mail', async () => {
    for (const email of [clienteA.email, engB.email, profissional.email]) {
      const response = await criar(await loginAs(t.app, email, SENHA));
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
    }
    expect(await t.db.select().from(appointments)).toHaveLength(0);
    expect(await emails()).toHaveLength(0);
  });

  it('campos inválidos respondem 400 com as mensagens do modelo', async () => {
    const response = await criar(await loginAs(t.app, engA.email, SENHA), {
      servico: 'ab',
      data: '2026-02-30',
      hora: '9h',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { fields: Record<string, string> } }>().error.fields).toMatchObject({
      servico: 'Informe o serviço.',
      data: 'Informe uma data válida.',
      hora: 'Informe o horário.',
    });
  });
});

describe('PATCH /api/appointments/:id', () => {
  it('trocar o status enfileira o e-mail de atualização', async () => {
    const id = await semear({ data: '2026-11-20', hora: '09:30', servico: 'Revisão elétrica' });
    const response = await send('PATCH', `/api/appointments/${id}`, await loginAs(t.app, engA.email, SENHA), {
      status: 'adiado',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<Appointment>()).toMatchObject({ id, status: 'adiado', servico: 'Revisão elétrica' });
    const fila = await emails();
    expect(fila).toHaveLength(1);
    expect(fila[0]).toMatchObject({
      to: 'marina@cliente.test',
      template: 'agendamento',
      data: { acao: 'atualizado', servico: 'Revisão elétrica', data: '20/11/2026', hora: '09:30', status: 'Adiado' },
    });
  });

  it('salvar o corpo completo sem mudança não enfileira e-mail; uma mudança real enfileira', async () => {
    const id = await semear({ data: '2026-11-20', hora: '09:30', servico: 'Revisão elétrica' });
    const cookie = await loginAs(t.app, engA.email, SENHA);
    const corpo = {
      propertyId: clienteA.propertyId,
      servico: 'Revisão elétrica',
      data: '2026-11-20',
      hora: '09:30',
      status: 'confirmado',
      descricao: '',
    };
    const igual = await send('PATCH', `/api/appointments/${id}`, cookie, corpo);
    expect(igual.statusCode).toBe(200);
    expect(await emails()).toHaveLength(0);
    const mudou = await send('PATCH', `/api/appointments/${id}`, cookie, { ...corpo, hora: '10:00' });
    expect(mudou.statusCode).toBe(200);
    const fila = await emails();
    expect(fila).toHaveLength(1);
    expect(fila[0]?.data).toMatchObject({ acao: 'atualizado', hora: '10:00' });
  });

  it('corpo vazio devolve o agendamento atual sem e-mail; sem acesso continua 404', async () => {
    const id = await semear({ data: '2026-11-20', hora: '09:30', servico: 'Revisão elétrica' });
    const vazio = await send('PATCH', `/api/appointments/${id}`, await loginAs(t.app, engA.email, SENHA), {});
    expect(vazio.statusCode).toBe(200);
    expect(vazio.json<Appointment>()).toMatchObject({ id, status: 'confirmado', servico: 'Revisão elétrica', hora: '09:30' });
    const alheio = await send('PATCH', `/api/appointments/${id}`, await loginAs(t.app, engB.email, SENHA), {});
    expect(alheio.statusCode).toBe(404);
    expect(await emails()).toHaveLength(0);
  });

  it('admin muda data, hora, imóvel e limpa a descrição', async () => {
    const id = await semear({ data: '2026-11-20', hora: '09:30' });
    await t.db.update(appointments).set({ descricao: 'Levar escada' }).where(eq(appointments.id, id));
    const response = await send('PATCH', `/api/appointments/${id}`, await loginAs(t.app, admin.email, SENHA), {
      data: '2026-12-02',
      hora: '15:45',
      propertyId: segundoImovelA,
      descricao: '',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<Appointment>()).toMatchObject({
      data: '2026-12-02',
      hora: '15:45',
      propertyId: segundoImovelA,
      propertyApelido: 'Apartamento da praia',
      descricao: null,
    });
    const [mail] = await emails();
    expect(mail?.data).toMatchObject({ data: '02/12/2026', hora: '15:45', imovel: 'Apartamento da praia' });
  });

  it('imóvel de outro cliente responde 400, nada muda e não há e-mail', async () => {
    const id = await semear({ data: '2026-11-20', hora: '09:30' });
    const response = await send('PATCH', `/api/appointments/${id}`, await loginAs(t.app, engA.email, SENHA), {
      propertyId: clienteB.propertyId,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(IMOVEL_INVALIDO);
    expect((await linha(id))?.propertyId).toBe(clienteA.propertyId);
    expect(await emails()).toHaveLength(0);
  });

  it('cliente, engenheiro de outro e profissional recebem 404 e não há e-mail', async () => {
    const id = await semear({ data: '2026-11-20', hora: '09:30' });
    for (const email of [clienteA.email, engB.email, profissional.email]) {
      const response = await send('PATCH', `/api/appointments/${id}`, await loginAs(t.app, email, SENHA), {
        status: 'adiado',
      });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
    }
    expect((await linha(id))?.status).toBe('confirmado');
    expect(await emails()).toHaveLength(0);
  });

  it('agendamento inexistente responde 404', async () => {
    const response = await send(
      'PATCH',
      '/api/appointments/3f2b8c1e-5a47-4d6e-9b1a-0c7d2e4f6a81',
      await loginAs(t.app, admin.email, SENHA),
      { status: 'adiado' },
    );
    expect(response.statusCode).toBe(404);
  });
});

describe('DELETE /api/appointments/:id', () => {
  it('engenheiro dono exclui sem enviar e-mail', async () => {
    const id = await semear({ data: '2026-11-20', hora: '09:30' });
    const response = await send('DELETE', `/api/appointments/${id}`, await loginAs(t.app, engA.email, SENHA));
    expect(response.statusCode).toBe(204);
    expect(await linha(id)).toBeUndefined();
    expect(await emails()).toHaveLength(0);
  });

  it('cliente e engenheiro de outro recebem 404 e o agendamento continua', async () => {
    const id = await semear({ data: '2026-11-20', hora: '09:30' });
    for (const email of [clienteA.email, engB.email]) {
      const response = await send('DELETE', `/api/appointments/${id}`, await loginAs(t.app, email, SENHA));
      expect(response.statusCode).toBe(404);
    }
    expect(await linha(id)).toBeDefined();
  });
});
