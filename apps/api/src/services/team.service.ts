import { and, eq } from 'drizzle-orm';
import type { AdminApplication, ApplicationArea, Role, TeamInviteInput, TeamInviteResult } from '@fixable/shared';
import { applications, users } from '../models/index.ts';
import type { PlatformMailDeps, Viewer } from '../types/platform.types.ts';
import type { Tx } from '../types/db.types.ts';
import { AppError } from '../utils/app-error.ts';
import { demoEmailFilter, isDemoEmail } from '../utils/demo-email.ts';
import { notFound } from './access-policy.service.ts';
import { applicationColumns, toAdminApplication } from './admin.service.ts';
import { sendInvite } from './invite.service.ts';

const ALREADY_REVIEWED_MESSAGE = 'Esta candidatura já foi analisada.';
const ACCOUNT_EXISTS_MESSAGE = 'Já existe uma conta com este e-mail.';
export const DEMO_UNAVAILABLE_MESSAGE = 'Indisponível no modo demonstração.';

const ROLE_BY_AREA: Record<ApplicationArea, Role> = { engenheiro: 'engenheiro', outro: 'profissional' };

/** Cria o erro 409 com a mensagem informada. */
const conflict = (message: string): AppError => new AppError(409, 'conflict', message);

/** Trava a candidatura (o admin demo só alcança as da demonstração) e recusa com 409 se já não está pendente. */
async function lockPendingApplication(tx: Tx, viewer: Viewer, applicationId: string) {
  const [application] = await tx
    .select(applicationColumns)
    .from(applications)
    .where(and(eq(applications.id, applicationId), viewer.isDemo ? demoEmailFilter(applications.email) : undefined))
    .for('update');
  if (!application) throw notFound();
  if (application.status !== 'pendente') throw conflict(ALREADY_REVIEWED_MESSAGE);
  return application;
}

/** Grava o novo status da candidatura e a devolve no formato da API. */
async function setApplicationStatus(
  tx: Tx,
  applicationId: string,
  status: AdminApplication['status'],
): Promise<AdminApplication> {
  const [updated] = await tx
    .update(applications)
    .set({ status })
    .where(eq(applications.id, applicationId))
    .returning(applicationColumns);
  return toAdminApplication(updated!);
}

/** Aprova a candidatura pendente, cria a conta convidada (demo se o e-mail for demo) e envia o convite. */
export async function approveApplication(
  { db, config }: PlatformMailDeps,
  viewer: Viewer,
  applicationId: string,
): Promise<AdminApplication> {
  return db.transaction(async (tx) => {
    const application = await lockPendingApplication(tx, viewer, applicationId);
    const [created] = await tx
      .insert(users)
      .values({
        role: ROLE_BY_AREA[application.area],
        status: 'convidado',
        nome: application.nome,
        email: application.email.trim().toLowerCase(),
        telefone: application.telefone,
        cidade: application.cidade,
        isDemo: isDemoEmail(application.email),
      })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    if (!created) throw conflict(ACCOUNT_EXISTS_MESSAGE);
    const approved = await setApplicationStatus(tx, applicationId, 'aprovada');
    await sendInvite(tx, config, created.id);
    return approved;
  });
}

/** Recusa a candidatura pendente sem criar conta nem enviar e-mail. */
export async function refuseApplication(
  { db }: PlatformMailDeps,
  viewer: Viewer,
  applicationId: string,
): Promise<AdminApplication> {
  return db.transaction(async (tx) => {
    await lockPendingApplication(tx, viewer, applicationId);
    return setApplicationStatus(tx, applicationId, 'recusada');
  });
}

/** Convida engenheiro ou admin, reenviando ao convidado do mesmo papel; o admin demo não convida ninguém. */
export async function inviteTeamMember(
  { db, config }: PlatformMailDeps,
  viewer: Viewer,
  input: TeamInviteInput,
): Promise<TeamInviteResult> {
  if (viewer.isDemo) throw new AppError(403, 'forbidden', DEMO_UNAVAILABLE_MESSAGE);
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({ role: input.role, status: 'convidado', nome: input.nome, email: input.email })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    if (created) {
      await sendInvite(tx, config, created.id);
      return { userId: created.id, convite: 'enviado' };
    }
    const [existing] = await tx
      .select({ id: users.id, role: users.role, status: users.status })
      .from(users)
      .where(eq(users.email, input.email))
      .for('update');
    if (existing?.status !== 'convidado' || existing.role !== input.role) throw conflict(ACCOUNT_EXISTS_MESSAGE);
    await sendInvite(tx, config, existing.id);
    return { userId: existing.id, convite: 'reenviado' };
  });
}
