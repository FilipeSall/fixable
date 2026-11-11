import { and, desc, eq, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type {
  AdminApplication,
  AdminApplicationsQuery,
  AdminLead,
  AdminLeadsQuery,
  TeamInviteResult,
} from '@fixable/shared';
import type { Config } from '../types/config.types.ts';
import type { Db } from '../types/db.types.ts';
import { applications, diagnosticLeads, users } from '../models/index.ts';
import type { ApplicationRow, LeadRow } from '../types/admin.types.ts';
import type { Viewer } from '../types/platform.types.ts';
import { demoEmailFilter } from '../utils/demo-email.ts';
import { sendInvite } from './invite.service.ts';

const DUPLICATE_MESSAGE = 'Já existe um usuário com este e-mail.';

const engineers = alias(users, 'engineers');

export const applicationColumns = {
  id: applications.id,
  nome: applications.nome,
  email: applications.email,
  telefone: applications.telefone,
  cidade: applications.cidade,
  area: applications.area,
  status: applications.status,
  createdAt: applications.createdAt,
};

/** Converte a candidatura do banco no formato da API, com a data em ISO. */
export const toAdminApplication = (row: ApplicationRow): AdminApplication => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
});

/** Converte o lead do banco no formato da API, com o engenheiro como objeto e a data em ISO. */
const toAdminLead = ({ engenheiro, ...row }: LeadRow): AdminLead => ({
  ...row,
  engenheiro: engenheiro === null ? null : { nome: engenheiro },
  createdAt: row.createdAt.toISOString(),
});

/** Cria o admin convidado e envia o convite, ou reenvia se ele ainda não aceitou, tudo numa transação. */
export async function createAdmin(
  db: Db,
  config: Pick<Config, 'APP_ORIGIN'>,
  input: { nome: string; email: string },
): Promise<TeamInviteResult> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({ role: 'admin', status: 'convidado', nome: input.nome, email: input.email })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    if (created) {
      await sendInvite(tx, config, created.id);
      return { userId: created.id, convite: 'enviado' };
    }
    const [existing] = await tx.select().from(users).where(eq(users.email, input.email)).for('update');
    if (existing?.role !== 'admin' || existing.status !== 'convidado') throw new Error(DUPLICATE_MESSAGE);
    await sendInvite(tx, config, existing.id);
    return { userId: existing.id, convite: 'reenviado' };
  });
}

/** Lista os pedidos de diagnóstico do mais novo ao mais antigo; o admin demo só vê os da demonstração. */
export async function listLeads(db: Db, viewer: Viewer, query: AdminLeadsQuery): Promise<AdminLead[]> {
  const rows = await db
    .select({
      id: diagnosticLeads.id,
      nome: diagnosticLeads.nome,
      email: diagnosticLeads.email,
      telefone: diagnosticLeads.telefone,
      cidade: diagnosticLeads.cidade,
      tipoImovel: diagnosticLeads.tipoImovel,
      plano: diagnosticLeads.plano,
      engenheiro: engineers.nome,
      createdAt: diagnosticLeads.createdAt,
    })
    .from(diagnosticLeads)
    .leftJoin(engineers, eq(engineers.id, diagnosticLeads.engineerId))
    .where(
      and(
        query.atribuicao === 'sem' ? isNull(diagnosticLeads.engineerId) : undefined,
        viewer.isDemo ? demoEmailFilter(diagnosticLeads.email) : undefined,
      ),
    )
    .orderBy(desc(diagnosticLeads.createdAt), desc(diagnosticLeads.id));
  return rows.map(toAdminLead);
}

/** Lista as candidaturas da mais nova à mais antiga, por status; o admin demo só vê as da demonstração. */
export async function listApplications(
  db: Db,
  viewer: Viewer,
  query: AdminApplicationsQuery,
): Promise<AdminApplication[]> {
  const rows = await db
    .select(applicationColumns)
    .from(applications)
    .where(
      and(
        query.status ? eq(applications.status, query.status) : undefined,
        viewer.isDemo ? demoEmailFilter(applications.email) : undefined,
      ),
    )
    .orderBy(desc(applications.createdAt), desc(applications.id));
  return rows.map(toAdminApplication);
}
