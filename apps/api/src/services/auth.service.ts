import { eq } from 'drizzle-orm';
import type { Config } from '../types/config.types.ts';
import type { Db, Tx } from '../types/db.types.ts';
import { users } from '../models/index.ts';
import type { SessionGrant, UserRow, VerifiedLogin } from '../types/auth.types.ts';
import type { EmailTokenPurpose } from '../types/email-token.types.ts';
import { AppError } from '../utils/app-error.ts';
import { hashPassword, verifyPassword } from '../utils/password.ts';
import { consumeEmailToken, peekEmailToken } from './email-token.service.ts';
import { sendInvite, sendPasswordReset } from './invite.service.ts';
import { createSession, revokeSession, revokeUserSessions } from './session.service.ts';

const DUMMY_PASSWORD_HASH = await hashPassword('senha-inexistente-0');

/** Cria o erro 410 de link expirado ou já usado. */
function tokenInvalid(): AppError {
  return new AppError(410, 'token_invalid', 'Este link expirou ou já foi usado.');
}

/** Cria o erro 401 de e-mail ou senha incorretos, sem revelar qual dos dois falhou. */
function invalidCredentials(): AppError {
  return new AppError(401, 'invalid_credentials', 'E-mail ou senha incorretos.');
}

/** Cria o erro 403 de conta bloqueada. */
function accountBlocked(): AppError {
  return new AppError(403, 'account_blocked', 'Sua conta está bloqueada. Fale com a Fixable.');
}

/** Confere que o link está aberto e é do propósito esperado e devolve o dono, antes de calcular o argon2. */
async function requireLiveTokenOwner(db: Db, token: string, purpose: EmailTokenPurpose): Promise<string> {
  const info = await peekEmailToken(db, token);
  if (info?.purpose !== purpose) throw tokenInvalid();
  return info.userId;
}

/** Trava o usuário antes de consumir o token, na mesma ordem da emissão de links, para não haver deadlock. */
async function lockUserAndConsume(
  tx: Tx,
  input: { userId: string; token: string; purpose: EmailTokenPurpose },
): Promise<UserRow | null> {
  const [user] = await tx.select().from(users).where(eq(users.id, input.userId)).for('update');
  if (!user) return null;
  const consumed = await consumeEmailToken(tx, input.token, input.purpose, user.id);
  return consumed ? user : null;
}

/** Confere e-mail, senha e situação da conta (conta demo só entra no modo demo), para só então emitir a sessão. */
export async function verifyLoginCredentials(
  db: Db,
  input: { email: string; senha: string; demoMode?: boolean },
): Promise<VerifiedLogin> {
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

  const passwordMatches = await verifyPassword(user?.passwordHash ?? DUMMY_PASSWORD_HASH, input.senha);
  if (!user?.passwordHash || !passwordMatches) throw invalidCredentials();
  if (user.isDemo && !input.demoMode) throw invalidCredentials();
  if (user.status === 'bloqueado') throw accountBlocked();
  if (user.status !== 'ativo') throw invalidCredentials();
  return { user, passwordHash: user.passwordHash };
}

/** Emite a sessão do login já verificado, revogando a sessão anterior do navegador. */
export async function issueLoginSession(
  db: Db,
  verified: VerifiedLogin,
  previousToken: string | undefined,
): Promise<SessionGrant> {
  const outcome = await db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, verified.user.id)).for('update');
    if (user?.passwordHash !== verified.passwordHash) return 'invalid' as const;
    if (user.status === 'bloqueado') return 'blocked' as const;
    if (user.status !== 'ativo') return 'invalid' as const;
    if (previousToken) await revokeSession(tx, previousToken);
    const session = await createSession(tx, user.id);
    return { user, session };
  });

  if (outcome === 'invalid') throw invalidCredentials();
  if (outcome === 'blocked') throw accountBlocked();
  const { id, nome, email, role } = outcome.user;
  return { user: { id, nome, email, role }, session: outcome.session };
}

/** Autentica por e-mail e senha e devolve o usuário com a nova sessão. */
export async function login(
  db: Db,
  input: { email: string; senha: string; previousToken: string | undefined; demoMode: boolean },
): Promise<SessionGrant> {
  const verified = await verifyLoginCredentials(db, input);
  return issueLoginSession(db, verified, input.previousToken);
}

/** Encerra a sessão do token informado, se houver um. */
export async function logout(db: Db, token: string | undefined): Promise<void> {
  if (token) await revokeSession(db, token);
}

/** Devolve a finalidade, o nome e o e-mail do dono de um link aberto, ou falha se o link não vale mais. */
export async function getTokenInfo(
  db: Db,
  token: string,
): Promise<{ purpose: EmailTokenPurpose; nome: string; email: string }> {
  const info = await peekEmailToken(db, token);
  if (!info) throw tokenInvalid();
  return { purpose: info.purpose, nome: info.nome, email: info.email };
}

/** Aceita o convite: grava a senha, ativa a conta e abre a sessão. */
export async function acceptInvite(db: Db, input: { token: string; senha: string }): Promise<SessionGrant> {
  const { token, senha } = input;
  const userId = await requireLiveTokenOwner(db, token, 'convite');
  const passwordHash = await hashPassword(senha);
  const outcome = await db.transaction(async (tx) => {
    const user = await lockUserAndConsume(tx, { userId, token, purpose: 'convite' });
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

/** Envia o link de redefinição ou de convite conforme a situação da conta, sem revelar se o e-mail existe. */
export async function forgotPassword(db: Db, config: Pick<Config, 'APP_ORIGIN'>, email: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (user?.status === 'ativo') await sendPasswordReset(db, config, user.id);
  if (user?.status === 'convidado') await sendInvite(db, config, user.id);
}

/** Redefine a senha com o link, consome o token e revoga as sessões do usuário. */
export async function resetPassword(db: Db, input: { token: string; senha: string }): Promise<void> {
  const { token, senha } = input;
  const userId = await requireLiveTokenOwner(db, token, 'redefinicao');
  const passwordHash = await hashPassword(senha);
  const done = await db.transaction(async (tx) => {
    const user = await lockUserAndConsume(tx, { userId, token, purpose: 'redefinicao' });
    if (!user) return false;
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));
    await revokeUserSessions(tx, user.id);
    return true;
  });
  if (!done) throw tokenInvalid();
}
