import type { EngineerAppointment } from '@fixable/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appointments } from '../../src/models/index.ts';
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

let t: TestApp;
let engA: { id: string; email: string };
let engB: { id: string; email: string };
let clienteA1: ClientWithProperty;
let clienteA2: ClientWithProperty;
let clienteB: ClientWithProperty;

beforeEach(async () => {
  t = await testApp();
  await t.app.ready();
  await resetDb(t.db);
  engA = await createEngineer(t.db, { senha: SENHA });
  engB = await createEngineer(t.db, { senha: SENHA });
  clienteA1 = await createClientWithProperty(t.db, { engineerId: engA.id, senha: SENHA, nome: 'Marina Souza' });
  clienteA2 = await createClientWithProperty(t.db, { engineerId: engA.id, nome: 'João Alves', apelido: 'Loja' });
  clienteB = await createClientWithProperty(t.db, { engineerId: engB.id, nome: 'Cliente do B' });
});
afterEach(async () => {
  await t.close();
});

function get(url: string, cookie: string) {
  return t.app.inject({ method: 'GET', url, headers: { cookie, origin: ORIGIN } });
}

async function semear(cliente: ClientWithProperty, data: string, hora: string) {
  const [row] = await t.db
    .insert(appointments)
    .values({
      clientId: cliente.clientId,
      propertyId: cliente.propertyId,
      servico: `Visita ${data} ${hora}`,
      data,
      hora,
      status: 'pendente',
    })
    .returning({ id: appointments.id });
  return row!.id;
}

describe('GET /api/appointments', () => {
  it('engenheiro vê só os agendamentos dos seus clientes no mês, por data e hora, com o cliente', async () => {
    await semear(clienteA1, '2026-10-31', '10:00');
    const tarde = await semear(clienteA1, '2026-11-05', '14:00');
    const manha = await semear(clienteA2, '2026-11-05', '08:00');
    const primeiro = await semear(clienteA2, '2026-11-01', '18:00');
    await semear(clienteA1, '2026-12-01', '08:00');
    await semear(clienteB, '2026-11-04', '09:00');
    const response = await get('/api/appointments?mes=2026-11', await loginAs(t.app, engA.email, SENHA));
    expect(response.statusCode).toBe(200);
    const lista = response.json<EngineerAppointment[]>();
    expect(lista.map((item) => item.id)).toEqual([primeiro, manha, tarde]);
    expect(lista[1]).toEqual({
      id: manha,
      propertyId: clienteA2.propertyId,
      propertyApelido: 'Loja',
      servico: 'Visita 2026-11-05 08:00',
      data: '2026-11-05',
      hora: '08:00',
      status: 'pendente',
      descricao: null,
      clientId: clienteA2.clientId,
      clientNome: 'João Alves',
    });
  });

  it('engenheiro B não vê os clientes de A', async () => {
    await semear(clienteA1, '2026-11-05', '08:00');
    const doB = await semear(clienteB, '2026-11-04', '09:00');
    const response = await get('/api/appointments?mes=2026-11', await loginAs(t.app, engB.email, SENHA));
    expect(response.json<EngineerAppointment[]>().map((item) => item.id)).toEqual([doB]);
  });

  it('admin vê os agendamentos de todos os clientes', async () => {
    const admin = await createUser(t.db, { role: 'admin', senha: SENHA });
    await semear(clienteA1, '2026-11-05', '08:00');
    await semear(clienteB, '2026-11-04', '09:00');
    const response = await get('/api/appointments?mes=2026-11', await loginAs(t.app, admin.email, SENHA));
    expect(response.json<EngineerAppointment[]>().map((item) => item.clientNome)).toEqual([
      'Cliente do B',
      'Marina Souza',
    ]);
  });

  it('cliente e profissional recebem 403; sem sessão 401', async () => {
    const profissional = await createUser(t.db, { role: 'profissional', senha: SENHA });
    for (const email of [clienteA1.email, profissional.email]) {
      const response = await get('/api/appointments?mes=2026-11', await loginAs(t.app, email, SENHA));
      expect(response.statusCode).toBe(403);
    }
    expect((await t.app.inject({ method: 'GET', url: '/api/appointments?mes=2026-11' })).statusCode).toBe(401);
  });

  it('mês ausente ou inválido responde 400', async () => {
    const cookie = await loginAs(t.app, engA.email, SENHA);
    for (const query of ['', '?mes=2026-13', '?mes=2026-1']) {
      expect((await get(`/api/appointments${query}`, cookie)).statusCode).toBe(400);
    }
  });
});
