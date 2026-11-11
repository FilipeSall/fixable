import { and, asc, count, desc, eq, inArray, ne, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { ClientDetail, ClientListItem, ClientListResponse } from '@fixable/shared';
import { appointments, clients, properties, serviceRequests, services, users } from '../models/index.ts';
import type { Db } from '../types/db.types.ts';
import type { Viewer } from '../types/platform.types.ts';
import { notFound, requireClientAccess } from './access-policy.service.ts';

const NEW_CLIENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const engineers = alias(users, 'engineers');

/** Devolve o id do cadastro de cliente do usuário logado, ou 404 quando ele não tem cadastro. */
export async function findMyClientId(db: Db, viewer: Viewer): Promise<{ clientId: string }> {
  const [client] = await db.select({ clientId: clients.id }).from(clients).where(eq(clients.userId, viewer.id));
  if (!client) throw notFound();
  return client;
}

/** Monta o filtro da lista de clientes: o admin vê todos e o engenheiro só os vinculados a ele. */
function visibleClients(viewer: Viewer): SQL | undefined {
  return viewer.role === 'admin' ? undefined : eq(clients.engineerId, viewer.id);
}

/** Conta, por cliente, os registros de uma consulta agrupada e devolve um mapa clientId → total. */
async function countByClient(rows: Promise<{ clientId: string; total: number }[]>): Promise<Map<string, number>> {
  return new Map((await rows).map((row) => [row.clientId, row.total]));
}

/** Busca o imóvel mais antigo de cada cliente, usado para mostrar tipo e cidade no card. */
async function firstPropertyByClient(db: Db, clientIds: string[]) {
  const rows = await db
    .select({ clientId: properties.clientId, tipo: properties.tipo, cidade: properties.cidade })
    .from(properties)
    .where(inArray(properties.clientId, clientIds))
    .orderBy(asc(properties.createdAt), asc(properties.id));
  const first = new Map<string, { tipo: ClientListItem['tipoImovel']; cidade: string }>();
  for (const row of rows) if (!first.has(row.clientId)) first.set(row.clientId, row);
  return first;
}

/** Conta os serviços não concluídos de cada cliente, somando todos os imóveis dele. */
function activeServicesByClient(db: Db, clientIds: string[]) {
  return countByClient(
    db
      .select({ clientId: properties.clientId, total: count() })
      .from(services)
      .innerJoin(properties, eq(services.propertyId, properties.id))
      .where(and(inArray(properties.clientId, clientIds), ne(services.status, 'concluido')))
      .groupBy(properties.clientId),
  );
}

/** Conta as solicitações ainda não concluídas de cada cliente. */
function openRequestsByClient(db: Db, clientIds: string[]) {
  return countByClient(
    db
      .select({ clientId: serviceRequests.clientId, total: count() })
      .from(serviceRequests)
      .where(and(inArray(serviceRequests.clientId, clientIds), ne(serviceRequests.status, 'concluido')))
      .groupBy(serviceRequests.clientId),
  );
}

/** Conta os agendamentos pendentes de confirmação entre os clientes informados. */
async function pendingAppointments(db: Db, clientIds: string[]): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(appointments)
    .where(and(inArray(appointments.clientId, clientIds), eq(appointments.status, 'pendente')));
  return row?.total ?? 0;
}

/** Lista os clientes visíveis ao engenheiro ou admin, do mais novo ao mais antigo, com os totais do painel. */
export async function listClients(db: Db, viewer: Viewer, now: Date = new Date()): Promise<ClientListResponse> {
  const rows = await db
    .select({ id: clients.id, nome: users.nome, createdAt: clients.createdAt })
    .from(clients)
    .innerJoin(users, eq(clients.userId, users.id))
    .where(visibleClients(viewer))
    .orderBy(desc(clients.createdAt), desc(clients.id));
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) {
    return {
      stats: { clientes: 0, solicitacoesAbertas: 0, servicosEmAndamento: 0, agendamentosAConfirmar: 0 },
      clients: [],
    };
  }
  const [firstProperty, activeServices, openRequests, agendamentosAConfirmar] = await Promise.all([
    firstPropertyByClient(db, ids),
    activeServicesByClient(db, ids),
    openRequestsByClient(db, ids),
    pendingAppointments(db, ids),
  ]);
  const items: ClientListItem[] = rows.map((row) => ({
    id: row.id,
    nome: row.nome,
    tipoImovel: firstProperty.get(row.id)?.tipo ?? null,
    cidade: firstProperty.get(row.id)?.cidade ?? null,
    novo: now.getTime() - row.createdAt.getTime() < NEW_CLIENT_WINDOW_MS,
    servicosAtivos: activeServices.get(row.id) ?? 0,
    solicitacoesAbertas: openRequests.get(row.id) ?? 0,
  }));
  return {
    stats: {
      clientes: items.length,
      solicitacoesAbertas: items.reduce((total, item) => total + item.solicitacoesAbertas, 0),
      servicosEmAndamento: items.reduce((total, item) => total + item.servicosAtivos, 0),
      agendamentosAConfirmar,
    },
    clients: items,
  };
}

/** Devolve os dados do cliente com o engenheiro responsável e os imóveis, exigindo permissão de leitura. */
export async function getClientDetail(db: Db, viewer: Viewer, clientId: string): Promise<ClientDetail> {
  await requireClientAccess(db, viewer, clientId, 'read');
  const [client] = await db
    .select({
      id: clients.id,
      nome: users.nome,
      email: users.email,
      telefone: users.telefone,
      engenheiroNome: engineers.nome,
    })
    .from(clients)
    .innerJoin(users, eq(clients.userId, users.id))
    .leftJoin(engineers, eq(clients.engineerId, engineers.id))
    .where(eq(clients.id, clientId));
  if (!client) throw notFound();
  const imoveis = await db
    .select({ id: properties.id, apelido: properties.apelido, tipo: properties.tipo, cidade: properties.cidade })
    .from(properties)
    .where(eq(properties.clientId, clientId))
    .orderBy(asc(properties.createdAt), asc(properties.id));
  const { engenheiroNome, ...dados } = client;
  return {
    ...dados,
    engenheiro: engenheiroNome === null ? null : { nome: engenheiroNome },
    properties: imoveis,
  };
}
