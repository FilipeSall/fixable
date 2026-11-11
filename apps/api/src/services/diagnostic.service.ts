import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { CONTACT_PREFERENCE_LABELS, PROPERTY_TYPE_LABELS, planName, type DiagnosticInput } from '@fixable/shared';
import { clients, diagnosticLeads, serviceRequests, users } from '../models/index.ts';
import type { Db, Tx } from '../types/db.types.ts';
import type { NovoLeadData } from '../types/mail.types.ts';
import type {
  EngineerRef,
  ExistingAccount,
  ExistingClient,
  LeadAssignment,
  PublicConfig,
} from '../types/public.types.ts';
import { insertInvitedClientUser, onboardClient, requestDescription } from './client-onboarding.service.ts';
import { resendPublicLink } from './invite.service.ts';
import { enqueueEmail } from './outbox.service.ts';

const EMPTY_VALUE = '—';
const UNASSIGNED = 'Sem atribuição';
const LOGIN_PATH = '/app/login';
const NO_ASSIGNMENT: LeadAssignment = { clientId: null, engineer: null };
const engineers = alias(users, 'engineers');

/** Busca a conta do e-mail travando a linha, para serializar envios do mesmo usuário até o fim da transação. */
async function lockAccount(tx: Tx, email: string): Promise<ExistingAccount | null> {
  const [account] = await tx
    .select({ userId: users.id, role: users.role, status: users.status, nome: users.nome, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .for('update');
  return account ?? null;
}

/** Busca o registro de cliente da conta com o engenheiro atribuído, se houver. */
async function findClient(tx: Tx, userId: string): Promise<ExistingClient | null> {
  const [row] = await tx
    .select({ clientId: clients.id, engineerId: engineers.id, engineerNome: engineers.nome })
    .from(clients)
    .leftJoin(engineers, eq(engineers.id, clients.engineerId))
    .where(eq(clients.userId, userId));
  if (!row) return null;
  const engineer: EngineerRef | null =
    row.engineerId && row.engineerNome ? { id: row.engineerId, nome: row.engineerNome } : null;
  return { clientId: row.clientId, engineer };
}

/** Avisa o cliente existente conforme o status: reenvia o convite, confirma o recebimento ou não envia nada. */
async function notifyExistingClient(tx: Tx, config: PublicConfig, account: ExistingAccount): Promise<void> {
  if (account.status === 'convidado') {
    await resendPublicLink(tx, config, account.userId, 'convite');
    return;
  }
  if (account.status === 'ativo') {
    await enqueueEmail(tx, {
      to: account.email,
      template: 'diagnostico-recebido',
      data: { nome: account.nome, loginUrl: new URL(LOGIN_PATH, config.APP_ORIGIN).toString() },
    });
  }
}

/** Trata o envio de uma conta já existente: cliente ganha solicitação adicional; outro perfil fica só com o lead. */
async function handleExistingAccount(
  tx: Tx,
  config: PublicConfig,
  account: ExistingAccount,
  input: DiagnosticInput,
): Promise<LeadAssignment> {
  if (account.role !== 'cliente') return NO_ASSIGNMENT;
  const client = await findClient(tx, account.userId);
  if (!client) return NO_ASSIGNMENT;
  await tx.insert(serviceRequests).values({
    clientId: client.clientId,
    propertyId: null,
    descricao: requestDescription('adicional', input),
  });
  await notifyExistingClient(tx, config, account);
  return client;
}

/** Resolve a conta do e-mail, criando o cliente novo ou seguindo o ramo da conta existente. */
async function resolveAssignment(tx: Tx, config: PublicConfig, input: DiagnosticInput): Promise<LeadAssignment> {
  const existing = await lockAccount(tx, input.email);
  if (existing) return handleExistingAccount(tx, config, existing, input);
  const userId = await insertInvitedClientUser(tx, input);
  if (userId) return onboardClient(tx, config, userId, input);
  const concurrent = await lockAccount(tx, input.email);
  return concurrent ? handleExistingAccount(tx, config, concurrent, input) : NO_ASSIGNMENT;
}

/** Monta os dados do aviso de novo lead à equipe, já com os rótulos legíveis. */
function novoLeadData(input: DiagnosticInput, engineer: EngineerRef | null): NovoLeadData {
  return {
    nome: input.nome,
    email: input.email,
    telefone: input.telefone,
    cidade: input.cidade,
    tipoImovel: PROPERTY_TYPE_LABELS[input.tipoImovel],
    preferenciaContato: CONTACT_PREFERENCE_LABELS[input.preferenciaContato],
    plano: input.plano ? planName(input.plano) : EMPTY_VALUE,
    descricao: input.descricao ?? EMPTY_VALUE,
    engenheiro: engineer?.nome ?? UNASSIGNED,
  };
}

/** Registra o pedido de diagnóstico do site numa transação: lead, cliente ou solicitação, e os e-mails. */
export async function submitDiagnostic(
  db: Db,
  config: PublicConfig,
  input: DiagnosticInput,
  now: Date = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
    const { clientId, engineer } = await resolveAssignment(tx, config, input);
    await tx.insert(diagnosticLeads).values({
      nome: input.nome,
      email: input.email,
      telefone: input.telefone,
      cidade: input.cidade,
      tipoImovel: input.tipoImovel,
      descricao: input.descricao ?? null,
      preferenciaContato: input.preferenciaContato,
      plano: input.plano ?? null,
      consentAt: now,
      clientId,
      engineerId: engineer?.id ?? null,
    });
    await enqueueEmail(tx, { to: config.TEAM_EMAIL, template: 'novo-lead', data: novoLeadData(input, engineer) });
  });
}
