import { and, eq, inArray, like, notInArray, or } from 'drizzle-orm';
import { DEMO_SENHA } from '@fixable/shared';
import {
  DEMO_ACCOUNTS,
  DEMO_APPLICATIONS,
  DEMO_CLIENTS,
  DEMO_EMAIL_SUFFIX,
  DEMO_ENGINEER,
  DEMO_TIME_ZONE,
  DEMO_UNASSIGNED_LEADS,
} from '../db/demo-data.ts';
import {
  applications,
  appointments,
  clients,
  diagnosticLeads,
  floors,
  properties,
  propertyAttributes,
  rooms,
  serviceRequests,
  services,
  users,
} from '../models/index.ts';
import type { Db, Tx } from '../types/db.types.ts';
import type {
  DemoAccountSeed,
  DemoAppointmentDate,
  DemoClientSeed,
  DemoConfig,
  DemoSeedSummary,
} from '../types/demo.types.ts';
import { addDays, dayInMonth, dayOfNextMonth, todayIn } from '../utils/calendar-date.ts';
import { hashPassword } from '../utils/password.ts';
import { insertDefaultFloorplan } from './property.service.ts';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const DEMO_EMAIL_PATTERN = `%${DEMO_EMAIL_SUFFIX}`;

export const DEMO_MODE_REQUIRED_MESSAGE =
  'Os dados de demonstração só podem ser criados com DEMO_MODE=true (a remoção com --remove funciona sempre).';

/** Recusa seguir quando algum e-mail da demonstração já pertence a uma conta real. */
async function assertNoRealAccount(tx: Tx): Promise<void> {
  const emails = DEMO_ACCOUNTS.map((account) => account.email);
  const conflicts = await tx
    .select({ email: users.email })
    .from(users)
    .where(and(inArray(users.email, emails), eq(users.isDemo, false)));
  if (conflicts.length > 0) {
    const list = conflicts.map((row) => row.email).join(', ');
    throw new Error(`Estes e-mails já pertencem a contas reais e não serão alterados: ${list}`);
  }
}

/** Apaga leads, candidaturas e contas extras (de candidaturas demo aprovadas) do domínio da demonstração. */
async function clearDemoExtras(tx: Tx, keepEmails: string[]): Promise<number> {
  await tx.delete(diagnosticLeads).where(like(diagnosticLeads.email, DEMO_EMAIL_PATTERN));
  await tx.delete(applications).where(like(applications.email, DEMO_EMAIL_PATTERN));
  const demoUsers = or(eq(users.isDemo, true), like(users.email, DEMO_EMAIL_PATTERN));
  const where = keepEmails.length > 0 ? and(demoUsers, notInArray(users.email, keepEmails)) : demoUsers;
  const removed = await tx.delete(users).where(where).returning({ id: users.id });
  return removed.length;
}

/** Cria ou atualiza pelo e-mail uma conta demo ativa, com a senha conhecida, e devolve o id. */
async function upsertAccount(tx: Tx, account: DemoAccountSeed, passwordHash: string): Promise<string> {
  const values = {
    role: account.role,
    status: 'ativo' as const,
    nome: account.nome,
    telefone: account.telefone,
    cidade: account.cidade,
    passwordHash,
    isDemo: true,
  };
  const [row] = await tx
    .insert(users)
    .values({ ...values, email: account.email })
    .onConflictDoUpdate({ target: users.email, set: values })
    .returning({ id: users.id });
  return row!.id;
}

/** Converte a data relativa do agendamento em YYYY-MM-DD, no mês atual ou no próximo. */
function appointmentDate(today: string, quando: DemoAppointmentDate): string {
  return quando.mes === 'atual' ? dayInMonth(today, quando.deslocamentoDias) : dayOfNextMonth(today, quando.dia);
}

/** Mapeia "posição do andar|nome do cômodo" para o id do cômodo, a partir da planta gravada do imóvel. */
async function roomIndex(tx: Tx, propertyId: string): Promise<Map<string, string>> {
  const rows = await tx
    .select({ posicao: floors.posicao, nome: rooms.nome, id: rooms.id })
    .from(rooms)
    .innerJoin(floors, eq(rooms.floorId, floors.id))
    .where(eq(floors.propertyId, propertyId));
  return new Map(rows.map((row) => [`${row.posicao}|${row.nome}`, row.id]));
}

/** Grava os serviços do cliente nos cômodos da planta, com prazo e conclusão relativos a agora. */
async function insertServices(tx: Tx, seed: DemoClientSeed, propertyId: string, now: Date, today: string) {
  if (seed.servicos.length === 0) return;
  const roomIds = await roomIndex(tx, propertyId);
  await tx.insert(services).values(
    seed.servicos.map((servico) => {
      const roomId = roomIds.get(`${servico.andar}|${servico.comodo}`);
      if (!roomId) throw new Error(`Cômodo ${servico.comodo} não existe na planta de ${seed.nome}.`);
      return {
        propertyId,
        roomId,
        titulo: servico.titulo,
        descricao: servico.descricao,
        status: servico.status,
        percentual: servico.percentual,
        prazo: servico.prazoEmDias === null ? null : addDays(today, servico.prazoEmDias),
        concludedAt:
          servico.concluidoHaHoras === undefined ? null : new Date(now.getTime() - servico.concluidoHaHoras * HOUR_MS),
      };
    }),
  );
}

/** Recria do zero o cadastro de um cliente demo: imóvel, dados, planta, serviços, solicitações e agenda. */
async function recreateClient(tx: Tx, seed: DemoClientSeed, ids: { userId: string; engineerId: string }, now: Date) {
  const today = todayIn(DEMO_TIME_ZONE, now);
  await tx.delete(clients).where(eq(clients.userId, ids.userId));
  const [client] = await tx
    .insert(clients)
    .values({ ...ids, createdAt: new Date(now.getTime() - seed.clienteHaDias * DAY_MS) })
    .returning({ id: clients.id });
  const clientId = client!.id;
  await tx.insert(diagnosticLeads).values({
    nome: seed.nome,
    email: seed.email,
    telefone: seed.telefone,
    cidade: seed.imovel.cidade,
    tipoImovel: seed.imovel.tipo,
    ...seed.diagnostico,
    consentAt: new Date(now.getTime() - seed.clienteHaDias * DAY_MS),
    clientId,
    engineerId: ids.engineerId,
    createdAt: new Date(now.getTime() - seed.clienteHaDias * DAY_MS),
  });
  const [property] = await tx
    .insert(properties)
    .values({ clientId, ...seed.imovel })
    .returning({ id: properties.id });
  const propertyId = property!.id;
  await tx
    .insert(propertyAttributes)
    .values(seed.residencia.map(([chave, valor], posicao) => ({ propertyId, chave, valor, posicao })));
  await insertDefaultFloorplan(tx, propertyId, seed.imovel.tipo);
  await insertServices(tx, seed, propertyId, now, today);
  await tx.insert(serviceRequests).values(
    seed.solicitacoes.map((solicitacao) => ({
      clientId,
      propertyId,
      descricao: solicitacao.descricao,
      status: solicitacao.status,
      createdAt: new Date(now.getTime() - solicitacao.diasAtras * DAY_MS),
    })),
  );
  await tx.insert(appointments).values(
    seed.agendamentos.map((agendamento) => ({
      clientId,
      propertyId,
      servico: agendamento.servico,
      data: appointmentDate(today, agendamento.quando),
      hora: agendamento.hora,
      status: agendamento.status,
      descricao: agendamento.descricao,
    })),
  );
}

/** Grava os leads sem atribuição e as candidaturas da demonstração, com datas relativas a agora. */
async function insertAdminQueue(tx: Tx, now: Date): Promise<void> {
  await tx.insert(diagnosticLeads).values(
    DEMO_UNASSIGNED_LEADS.map(({ horasAtras, ...lead }) => {
      const createdAt = new Date(now.getTime() - horasAtras * HOUR_MS);
      return { ...lead, consentAt: createdAt, createdAt };
    }),
  );
  await tx.insert(applications).values(
    DEMO_APPLICATIONS.map(({ diasAtras, ...application }) => {
      const createdAt = new Date(now.getTime() - diasAtras * DAY_MS);
      return { ...application, consentAt: createdAt, createdAt };
    }),
  );
}

/** Soma, entre os clientes demo, quantos itens de um tipo (serviços, solicitações...) a demonstração cria. */
function total(pick: (seed: DemoClientSeed) => unknown[]): number {
  return DEMO_CLIENTS.reduce((sum, seed) => sum + pick(seed).length, 0);
}

/** Resume o que a demonstração cria, para o comando informar o resultado. */
function summary(): DemoSeedSummary {
  return {
    usuarios: DEMO_ACCOUNTS.length,
    clientes: DEMO_CLIENTS.length,
    servicos: total((seed) => seed.servicos),
    solicitacoes: total((seed) => seed.solicitacoes),
    agendamentos: total((seed) => seed.agendamentos),
    leads: DEMO_CLIENTS.length + DEMO_UNASSIGNED_LEADS.length,
    candidaturas: DEMO_APPLICATIONS.length,
  };
}

/** Cria ou restaura as contas e os dados de demonstração numa transação, sem tocar em dados reais. */
export async function seedDemo(db: Db, config: DemoConfig, now: Date = new Date()): Promise<DemoSeedSummary> {
  if (!config.DEMO_MODE) throw new Error(DEMO_MODE_REQUIRED_MESSAGE);
  const passwordHash = await hashPassword(DEMO_SENHA);
  await db.transaction(async (tx) => {
    await assertNoRealAccount(tx);
    await clearDemoExtras(tx, DEMO_ACCOUNTS.map((account) => account.email));
    const userIds = new Map<string, string>();
    for (const account of DEMO_ACCOUNTS) userIds.set(account.email, await upsertAccount(tx, account, passwordHash));
    const engineerId = userIds.get(DEMO_ENGINEER.email)!;
    for (const seed of DEMO_CLIENTS) {
      await recreateClient(tx, seed, { userId: userIds.get(seed.email)!, engineerId }, now);
    }
    await insertAdminQueue(tx, now);
  });
  return summary();
}

/** Apaga contas, leads e candidaturas da demonstração e, em cascata, os clientes, imóveis e agendas delas. */
export async function removeDemo(db: Db): Promise<{ usuarios: number }> {
  const usuarios = await db.transaction((tx) => clearDemoExtras(tx, []));
  return { usuarios };
}
