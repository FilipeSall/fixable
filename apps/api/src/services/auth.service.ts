import { eq } from 'drizzle-orm';
import type { Me } from '@fixable/shared';
import type { Config } from '../config/env.ts';
import type { Db } from '../db/client.ts';
import { users } from '../models/index.ts';
import { AppError } from '../utils/app-error.ts';
import { hashPassword, verifyPassword } from '../utils/password.ts';
import { consumeEmailToken, peekEmailToken, type EmailTokenPurpose } from './email-token.service.ts';
import { sendInvite, sendPasswordReset } from './invite.service.ts';
import { createSession, revokeSession, revokeUserSessions } from './session.service.ts';

const DUMMY_PASSWORD_HASH = await hashPassword('senha-inexistente-0');

type SessionGrant = { user: Me; session: { token: string; expiresAt: Date } };

function tokenInvalid(): AppError {
  return new AppError(410, 'token_invalid', 'Este link expirou ou já foi usado.');
}

function invalidCredentials(): AppError {
  return new AppError(401, 'invalid_credentials', 'E-mail ou senha incorretos.');
}

function accountBlocked(): AppError {
  return new AppError(403, 'account_blocked', 'Sua conta está bloqueada. Fale com a Fixable.');
}

async function requireLivePurpose(db: Db, token: string, purpose: EmailTokenPurpose): Promise<void> {
  const info = await peekEmailToken(db, token);
  if (info?.purpose !== purpose) throw tokenInvalid();
}

export async function login(
  db: Db,
  input: { email: string; senha: string; previousToken: string | undefined },
): Promise<SessionGrant> {
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

  const passwordMatches = await verifyPassword(user?.passwordHash ?? DUMMY_PASSWORD_HASH, input.senha);
  if (!user?.passwordHash || !passwordMatches) throw invalidCredentials();
  if (user.status === 'bloqueado') throw accountBlocked();
  if (user.status !== 'ativo') throw invalidCredentials();

  if (input.previousToken) await revokeSession(db, input.previousToken);

  const session = await createSession(db, user.id);
  return { user: { id: user.id, nome: user.nome, email: user.email, role: user.role }, session };
}

export async function logout(db: Db, token: string | undefined): Promise<void> {
  if (token) await revokeSession(db, token);
}

export async function getTokenInfo(
  db: Db,
  token: string,
): Promise<{ purpose: EmailTokenPurpose; nome: string; email: string }> {
  const info = await peekEmailToken(db, token);
  if (!info) throw tokenInvalid();
  return { purpose: info.purpose, nome: info.nome, email: info.email };
}

export async function acceptInvite(db: Db, input: { token: string; senha: string }): Promise<SessionGrant> {
  const { token, senha } = input;
  await requireLivePurpose(db, token, 'convite');
  const passwordHash = await hashPassword(senha);
  const outcome = await db.transaction(async (tx) => {
    const consumed = await consumeEmailToken(tx, token, 'convite');
    if (!consumed) return null;
    const [user] = await tx.select().from(users).where(eq(users.id, consumed.userId)).for('update');
    if (!user) return null;
    if (user.status === 'bloqueado') return { blocked: true as const };
    await tx.update(users).set({ passwordHash, status: 'ativo', updatedAt: new Date() }).where(eq(users.id, user.id));
    const session = await createSession(tx, user.id);
    return { blocked: false as const, user, session };
  });

  if (!outcome) throw tokenInvalid();
  if (outcome.blocked) throw accountBlocked();
  const { id, nome, email, role } = outcome.user;
  return { user: { id, nome, email, role }, session: outcome.session };
}

export async function forgotPassword(db: Db, config: Pick<Config, 'APP_ORIGIN'>, email: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (user?.status === 'ativo') await sendPasswordReset(db, config, user.id);
  if (user?.status === 'convidado') await sendInvite(db, config, user.id);
}

export async function resetPassword(db: Db, input: { token: string; senha: string }): Promise<void> {
  const { token, senha } = input;
  await requireLivePurpose(db, token, 'redefinicao');
  const passwordHash = await hashPassword(senha);
  const done = await db.transaction(async (tx) => {
    const consumed = await consumeEmailToken(tx, token, 'redefinicao');
    if (!consumed) return false;
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, consumed.userId));
    await revokeUserSessions(tx, consumed.userId);
    return true;
  });
  if (!done) throw tokenInvalid();
}
