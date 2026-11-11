import { eq } from 'drizzle-orm';
import type { AdminApplication, ApplicationArea, Role, TeamInviteInput, TeamInviteResult } from '@fixable/shared';
import { applications, users } from '../models/index.ts';
import type { PlatformMailDeps } from '../types/platform.types.ts';
import type { Tx } from '../types/db.types.ts';
import { AppError } from '../utils/app-error.ts';
import { notFound } from './access-policy.service.ts';
import { applicationColumns, toAdminApplication } from './admin.service.ts';
import { sendInvite } from './invite.service.ts';

const ALREADY_REVIEWED_MESSAGE = 'Esta candidatura já foi analisada.';
const ACCOUNT_EXISTS_MESSAGE = 'Já existe uma conta com este e-mail.';

const ROLE_BY_AREA: Record<ApplicationArea, Role> = { engenheiro: 'engenheiro', outro: 'profissional' };

/** Cria o erro 409 com a mensagem informada. */
const conflict = (message: string): AppError => new AppError(409, 'conflict', message);

/** Trava a candidatura até o fim da transação e recusa com 409 quando ela já não está pendente. */
async function lockPendingApplication(tx: Tx, applicationId: string) {
  const [application] = await tx
    .select(applicationColumns)
    .from(applications)
    .where(eq(applications.id, applicationId))
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

/** Aprova a candidatura pendente criando a conta convidada do papel da área e enviando o convite, numa transação. */
export async function approveApplication(
  { db, config }: PlatformMailDeps,
  applicationId: string,
): Promise<AdminApplication> {
  return db.transaction(async (tx) => {
    const application = await lockPendingApplication(tx, applicationId);
    const [created] = await tx
      .insert(users)
      .values({
        role: ROLE_BY_AREA[application.area],
        status: 'convidado',
        nome: application.nome,
        email: application.email.trim().toLowerCase(),
        telefone: application.telefone,
        cidade: application.cidade,
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
export async function refuseApplication({ db }: PlatformMailDeps, applicationId: string): Promise<AdminApplication> {
  return db.transaction(async (tx) => {
    await lockPendingApplication(tx, applicationId);
    return setApplicationStatus(tx, applicationId, 'recusada');
  });
}

/** Convida engenheiro ou admin; reenvia ao convidado do mesmo papel e recusa com 409 qualquer outra conta. */
export async function inviteTeamMember({ db, config }: PlatformMailDeps, input: TeamInviteInput): Promise<TeamInviteResult> {
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
