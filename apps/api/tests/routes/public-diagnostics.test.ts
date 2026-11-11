import { asc, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { UserStatus } from '@fixable/shared';
import {
  clients,
  diagnosticLeads,
  emailOutbox,
  floors,
  properties,
  propertyAttributes,
  rooms,
  serviceRequests,
  users,
} from '../../src/models/index.ts';
import { createUser, resetDb, testApp, type TestApp } from '../helpers.ts';

const ORIGIN = 'http://localhost:4321';
const URL_DIAGNOSTICO = '/api/public/diagnostics';
const EQUIPE = 'equipe@fixable.local';

const envio = {
  nome: '  Ana Souza ',
  email: ' ana@ex.com ',
  telefone: '(11) 90000-0000',
  cidade: 'Santo André',
  tipoImovel: 'sobrado',
  descricao: 'Infiltração no banheiro da suíte',
  preferenciaContato: 'whatsapp',
  plano: '3m',
  aceiteTermos: true,
};

let t: TestApp;

beforeEach(async () => {
  t = await testApp();
  await t.app.ready();
  await resetDb(t.db);
});
afterEach(async () => {
  await t.close();
});

function enviar(payload: object = envio, headers: Record<string, string> = { origin: ORIGIN }) {
  return t.app.inject({ method: 'POST', url: URL_DIAGNOSTICO, headers, payload });
}

async function criarCliente(p: { email: string; status?: UserStatus; engineerId?: string | null; nome?: string }) {
  const user = await createUser(t.db, { role: 'cliente', status: p.status ?? 'ativo', email: p.email, nome: p.nome });
  const [client] = await t.db
    .insert(clients)
    .values({ userId: user.id, engineerId: p.engineerId ?? null })
    .returning({ id: clients.id });
  return { userId: user.id, clientId: client!.id };
}

async function filaPorTemplate() {
  const rows = await t.db.select().from(emailOutbox).orderBy(asc(emailOutbox.createdAt));
  return rows.map((row) => ({ to: row.to, template: row.template, data: row.data as Record<string, string> }));
}

function destinos(fila: Awaited<ReturnType<typeof filaPorTemplate>>) {
  return fila.map((item) => [item.template, item.to]).sort((a, b) => a.join().localeCompare(b.join()));
}

describe('POST /api/public/diagnostics', () => {
  it('diagnóstico novo cria lead, cliente, imóvel, 2 andares do sobrado, solicitação "Em análise" e enfileira convite + aviso à equipe', async () => {
    const engenheiro = await createUser(t.db, { role: 'engenheiro', nome: 'Carlos Lima' });
    const antes = Date.now();

    const response = await enviar();

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    const [user] = await t.db.select().from(users).where(eq(users.email, 'ana@ex.com'));
    expect(user).toMatchObject({
      role: 'cliente',
      status: 'convidado',
      nome: 'Ana Souza',
      telefone: '11900000000',
      cidade: 'Santo André',
      passwordHash: null,
    });

    const [client] = await t.db.select().from(clients).where(eq(clients.userId, user!.id));
    expect(client!.engineerId).toBe(engenheiro.id);

    const [lead, ...outrosLeads] = await t.db.select().from(diagnosticLeads);
    expect(outrosLeads).toHaveLength(0);
    expect(lead).toMatchObject({
      nome: 'Ana Souza',
      email: 'ana@ex.com',
      telefone: '11900000000',
      cidade: 'Santo André',
      tipoImovel: 'sobrado',
      descricao: 'Infiltração no banheiro da suíte',
      preferenciaContato: 'whatsapp',
      plano: '3m',
      clientId: client!.id,
      engineerId: engenheiro.id,
    });
    expect(lead!.consentAt.getTime()).toBeGreaterThanOrEqual(antes - 1000);

    const [imovel, ...outrosImoveis] = await t.db.select().from(properties);
    expect(outrosImoveis).toHaveLength(0);
    expect(imovel).toMatchObject({
      clientId: client!.id,
      tipo: 'sobrado',
      cidade: 'Santo André',
      apelido: 'Sobrado · Santo André',
    });

    const atributos = await t.db
      .select({ chave: propertyAttributes.chave, valor: propertyAttributes.valor, posicao: propertyAttributes.posicao })
      .from(propertyAttributes)
      .where(eq(propertyAttributes.propertyId, imovel!.id))
      .orderBy(asc(propertyAttributes.posicao));
    expect(atributos.map((a) => [a.chave, a.valor])).toEqual([
      ['Tipo de imóvel', 'Sobrado'],
      ['Cidade', 'Santo André'],
      ['Telefone', '11900000000'],
      ['E-mail', 'ana@ex.com'],
      ['Preferência de contato', 'WhatsApp'],
      ['Descrição do problema', 'Infiltração no banheiro da suíte'],
      ['Plano de interesse', 'Plano para 3 meses'],
    ]);

    const andares = await t.db.select().from(floors).where(eq(floors.propertyId, imovel!.id)).orderBy(asc(floors.posicao));
    expect(andares.map((andar) => andar.nome)).toEqual(['Andar 1', 'Andar 2']);
    const comodosAndar2 = await t.db
      .select()
      .from(rooms)
      .where(eq(rooms.floorId, andares[1]!.id))
      .orderBy(asc(rooms.posicao));
    expect(comodosAndar2.map((comodo) => comodo.nome)).toEqual(['Suíte', 'Quarto 2', 'Banheiro', 'Escritório', 'Varanda']);
    expect(comodosAndar2[0]).toMatchObject({ largura: 3, altura: 2 });

    const solicitacoes = await t.db.select().from(serviceRequests);
    expect(solicitacoes).toHaveLength(1);
    expect(solicitacoes[0]).toMatchObject({
      clientId: client!.id,
      propertyId: imovel!.id,
      status: 'em_analise',
      descricao: 'Diagnóstico inicial — Sobrado · Plano para 3 meses: Infiltração no banheiro da suíte',
    });

    const fila = await filaPorTemplate();
    expect(destinos(fila)).toEqual([
      ['convite', 'ana@ex.com'],
      ['novo-lead', EQUIPE],
    ]);
    expect(fila.find((item) => item.template === 'novo-lead')!.data).toEqual({
      nome: 'Ana Souza',
      email: 'ana@ex.com',
      telefone: '11900000000',
      cidade: 'Santo André',
      tipoImovel: 'Sobrado',
      preferenciaContato: 'WhatsApp',
      plano: 'Plano para 3 meses',
      descricao: 'Infiltração no banheiro da suíte',
      engenheiro: 'Carlos Lima',
    });
  });

  it('sem plano nem descrição: atributos e descrição da solicitação omitem os dois e o aviso mostra "—"', async () => {
    const semOpcionais = { ...envio, plano: undefined, descricao: undefined, tipoImovel: 'apartamento' };
    expect((await enviar(semOpcionais)).statusCode).toBe(204);

    const atributos = await t.db.select().from(propertyAttributes).orderBy(asc(propertyAttributes.posicao));
    expect(atributos.map((a) => a.chave)).toEqual([
      'Tipo de imóvel',
      'Cidade',
      'Telefone',
      'E-mail',
      'Preferência de contato',
    ]);
    const [solicitacao] = await t.db.select().from(serviceRequests);
    expect(solicitacao!.descricao).toBe('Diagnóstico inicial — Apartamento');
    expect(await t.db.select().from(floors)).toHaveLength(1);
    const aviso = (await filaPorTemplate()).find((item) => item.template === 'novo-lead')!;
    expect(aviso.data).toMatchObject({ plano: '—', descricao: '—' });
  });

  it('descrição longa entra na solicitação cortada em 120 caracteres', async () => {
    const descricao = 'a'.repeat(300);
    expect((await enviar({ ...envio, descricao })).statusCode).toBe(204);
    const [solicitacao] = await t.db.select().from(serviceRequests);
    expect(solicitacao!.descricao).toBe(`Diagnóstico inicial — Sobrado · Plano para 3 meses: ${'a'.repeat(120)}`);
  });

  it('atribui ao engenheiro ativo com menos clientes', async () => {
    const ocupado = await createUser(t.db, { role: 'engenheiro', nome: 'Ocupado' });
    const livre = await createUser(t.db, { role: 'engenheiro', nome: 'Livre' });
    await criarCliente({ email: 'outro@ex.com', engineerId: ocupado.id });

    expect((await enviar()).statusCode).toBe(204);

    const [user] = await t.db.select().from(users).where(eq(users.email, 'ana@ex.com'));
    const [client] = await t.db.select().from(clients).where(eq(clients.userId, user!.id));
    expect(client!.engineerId).toBe(livre.id);
    const [lead] = await t.db.select().from(diagnosticLeads);
    expect(lead!.engineerId).toBe(livre.id);
  });

  it('sem engenheiro ativo: cliente sem engenheiro, lead sem atribuição, convite e aviso com "Sem atribuição"', async () => {
    await createUser(t.db, { role: 'engenheiro', status: 'convidado' });
    await createUser(t.db, { role: 'engenheiro', status: 'bloqueado' });

    expect((await enviar()).statusCode).toBe(204);

    const [user] = await t.db.select().from(users).where(eq(users.email, 'ana@ex.com'));
    const [client] = await t.db.select().from(clients).where(eq(clients.userId, user!.id));
    expect(client!.engineerId).toBeNull();
    const [lead] = await t.db.select().from(diagnosticLeads);
    expect(lead).toMatchObject({ clientId: client!.id, engineerId: null });
    const fila = await filaPorTemplate();
    expect(fila.some((item) => item.template === 'convite' && item.to === 'ana@ex.com')).toBe(true);
    expect(fila.find((item) => item.template === 'novo-lead')!.data['engenheiro']).toBe('Sem atribuição');
  });

  it('e-mail de cliente existente com maiúsculas e espaços: nenhuma conta nova, solicitação adicional sem imóvel, dados da conta intactos', async () => {
    const engenheiro = await createUser(t.db, { role: 'engenheiro', nome: 'Beatriz Rocha' });
    const existente = await criarCliente({ email: 'ana@ex.com', nome: 'Ana Original', engineerId: engenheiro.id });
    const [antes] = await t.db.select().from(users).where(eq(users.id, existente.userId));

    const response = await enviar({ ...envio, email: '  ANA@Ex.COM  ', nome: 'Outro Nome', cidade: 'Mauá' });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(await t.db.select().from(users).where(eq(users.role, 'cliente'))).toHaveLength(1);
    expect(await t.db.select().from(clients)).toHaveLength(1);
    const [depois] = await t.db.select().from(users).where(eq(users.id, existente.userId));
    expect(depois).toEqual(antes);
    expect(await t.db.select().from(properties)).toHaveLength(0);

    const solicitacoes = await t.db.select().from(serviceRequests);
    expect(solicitacoes).toHaveLength(1);
    expect(solicitacoes[0]!.clientId).toBe(existente.clientId);
    expect(solicitacoes[0]!.propertyId).toBeNull();
    expect(solicitacoes[0]!.status).toBe('em_analise');
    expect(solicitacoes[0]!.descricao).toBe('Diagnóstico adicional — Sobrado · Plano para 3 meses');

    const [lead] = await t.db.select().from(diagnosticLeads);
    expect(lead).toMatchObject({
      email: 'ana@ex.com',
      nome: 'Outro Nome',
      cidade: 'Mauá',
      clientId: existente.clientId,
      engineerId: engenheiro.id,
    });
    const aviso = (await filaPorTemplate()).find((item) => item.template === 'novo-lead')!;
    expect(aviso.data['engenheiro']).toBe('Beatriz Rocha');
  });

  it.each([
    ['ativo', [['diagnostico-recebido', 'ana@ex.com'], ['novo-lead', EQUIPE]]],
    ['convidado', [['convite', 'ana@ex.com'], ['novo-lead', EQUIPE]]],
    ['bloqueado', [['novo-lead', EQUIPE]]],
  ] as const)('cliente existente %s recebe os e-mails certos', async (status, esperado) => {
    await criarCliente({ email: 'ana@ex.com', status, nome: 'Ana Original' });

    expect((await enviar()).statusCode).toBe(204);

    const fila = await filaPorTemplate();
    expect(destinos(fila)).toEqual(esperado.map((par) => [...par]));
    expect(await t.db.select().from(serviceRequests)).toHaveLength(1);
    const recebido = fila.find((item) => item.template === 'diagnostico-recebido');
    if (recebido) {
      expect(recebido.data).toEqual({ nome: 'Ana Original', loginUrl: 'http://localhost:4321/app/login' });
    }
  });

  it('cliente existente convidado: o segundo envio em menos de 10 min não emite outro convite', async () => {
    await criarCliente({ email: 'ana@ex.com', status: 'convidado' });
    expect((await enviar()).statusCode).toBe(204);
    expect((await enviar()).statusCode).toBe(204);
    const convites = (await filaPorTemplate()).filter((item) => item.template === 'convite');
    expect(convites).toHaveLength(1);
    expect(await t.db.select().from(serviceRequests)).toHaveLength(2);
  });

  it('envio anônimo com e-mail de cliente ativo não leva o texto livre para a solicitação nem para o e-mail do cliente', async () => {
    const existente = await criarCliente({ email: 'ana@ex.com', nome: 'Ana Original' });
    const phishing = 'URGENTE: confirme seus dados em golpe.example e ligue 0800 000 0000';

    expect((await enviar({ ...envio, descricao: phishing })).statusCode).toBe(204);

    const [solicitacao] = await t.db.select().from(serviceRequests).where(eq(serviceRequests.clientId, existente.clientId));
    expect(solicitacao!.descricao).not.toContain('golpe.example');
    const recebido = (await filaPorTemplate()).find((item) => item.template === 'diagnostico-recebido')!;
    expect(JSON.stringify(recebido.data)).not.toContain('golpe.example');
  });

  it('e-mail de engenheiro: só grava o lead, resposta 204', async () => {
    await createUser(t.db, { role: 'engenheiro', email: 'eng@ex.com', nome: 'Eng' });

    const response = await enviar({ ...envio, email: 'ENG@ex.com' });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(await t.db.select().from(users)).toHaveLength(1);
    expect(await t.db.select().from(clients)).toHaveLength(0);
    expect(await t.db.select().from(serviceRequests)).toHaveLength(0);
    expect(await t.db.select().from(properties)).toHaveLength(0);
    const leads = await t.db.select().from(diagnosticLeads);
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ email: 'eng@ex.com', clientId: null, engineerId: null });
    const fila = await filaPorTemplate();
    expect(fila.map((item) => [item.template, item.to])).toEqual([['novo-lead', EQUIPE]]);
    expect(fila[0]!.data['engenheiro']).toBe('Sem atribuição');
  });

  it('usuário cliente sem registro em clients é tratado como outro perfil: só o lead', async () => {
    await createUser(t.db, { role: 'cliente', email: 'ana@ex.com' });
    expect((await enviar()).statusCode).toBe(204);
    expect(await t.db.select().from(clients)).toHaveLength(0);
    expect(await t.db.select().from(serviceRequests)).toHaveLength(0);
    expect(await t.db.select().from(diagnosticLeads)).toHaveLength(1);
    expect((await filaPorTemplate()).map((item) => item.template)).toEqual(['novo-lead']);
  });

  it('dois envios simultâneos do mesmo e-mail novo criam 1 usuário e 1 cliente', async () => {
    await createUser(t.db, { role: 'engenheiro' });

    const respostas = await Promise.all([enviar(), enviar()]);

    expect(respostas.map((response) => response.statusCode)).toEqual([204, 204]);
    expect(await t.db.select().from(users).where(eq(users.email, 'ana@ex.com'))).toHaveLength(1);
    expect(await t.db.select().from(clients)).toHaveLength(1);
    expect(await t.db.select().from(properties)).toHaveLength(1);
    expect(await t.db.select().from(diagnosticLeads)).toHaveLength(2);
    expect(await t.db.select().from(serviceRequests)).toHaveLength(2);
  });

  it('honeypot preenchido: 204, nenhuma linha em diagnostic_leads nem em email_outbox', async () => {
    const response = await enviar({ ...envio, website: 'https://spam.example' });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(await t.db.select().from(diagnosticLeads)).toHaveLength(0);
    expect(await t.db.select().from(emailOutbox)).toHaveLength(0);
    expect(await t.db.select().from(users)).toHaveLength(0);
  });

  it('honeypot vazio segue o fluxo normal', async () => {
    expect((await enviar({ ...envio, website: '' })).statusCode).toBe(204);
    expect(await t.db.select().from(diagnosticLeads)).toHaveLength(1);
  });

  it('corpo inválido: 400 com fields.telefone = "Informe um telefone válido."', async () => {
    const response = await enviar({ ...envio, telefone: '1234' });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { code: string; fields: Record<string, string> } }>().error).toMatchObject({
      code: 'validation',
      fields: { telefone: 'Informe um telefone válido.' },
    });
    expect(await t.db.select().from(diagnosticLeads)).toHaveLength(0);
  });

  it('6º envio do mesmo IP em 15 min: 429, e a candidatura tem contagem própria', async () => {
    for (let envioAtual = 1; envioAtual <= 5; envioAtual += 1) {
      const response = await enviar({ ...envio, email: `ana${envioAtual}@ex.com` });
      expect(response.statusCode).toBe(204);
    }

    const sexto = await enviar({ ...envio, email: 'ana6@ex.com' });

    expect(sexto.statusCode).toBe(429);
    expect(sexto.json<{ error: { code: string } }>().error.code).toBe('rate_limited');
    expect(await t.db.select().from(diagnosticLeads)).toHaveLength(5);

    const candidatura = await t.app.inject({
      method: 'POST',
      url: '/api/public/applications',
      headers: { origin: ORIGIN },
      payload: {
        nome: 'Bruno Alves',
        email: 'bruno@ex.com',
        telefone: '11911112222',
        cidade: 'Santo André',
        area: 'engenheiro',
        aceiteTermos: true,
      },
    });
    expect(candidatura.statusCode).toBe(204);
  });

  it('sem Origin: 403', async () => {
    const response = await enviar(envio, {});

    expect(response.statusCode).toBe(403);
    expect(await t.db.select().from(diagnosticLeads)).toHaveLength(0);
  });
});
