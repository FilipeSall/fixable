import { eq } from 'drizzle-orm';
import type { Db, Tx } from '../types/db.types.ts';
import { users } from '../models/index.ts';
import { enqueueEmail } from './outbox.service.ts';
import type { EmailTokenPurpose, LinkConfig } from '../types/email-token.types.ts';
import { hasOpenTokenSince, issueEmailToken } from './email-token.service.ts';

const PUBLIC_RESEND_COOLDOWN_MS = 10 * 60 * 1000;

const LINK_PATHS: Record<EmailTokenPurpose, string> = {
  convite: '/app/convite',
  redefinicao: '/app/redefinir-senha',
};

/** Monta o link absoluto do app com o token no fragmento, que não vai ao servidor nem ao Referer e sobrevive ao reload. */
function buildLink(config: LinkConfig, purpose: EmailTokenPurpose, token: string): string {
  const url = new URL(LINK_PATHS[purpose], config.APP_ORIGIN);
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

/** Emite o link para o usuário e enfileira o e-mail correspondente na outbox. */
async function sendTokenEmail(
  db: Db | Tx,
  config: LinkConfig,
  userId: string,
  purpose: EmailTokenPurpose,
): Promise<void> {
  const [user] = await db
    .select({ nome: users.nome, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .for('update');
  if (!user) throw new Error('Usuário não encontrado.');
  const { id, token } = await issueEmailToken(db, userId, purpose);
  await enqueueEmail(db, {
    to: user.email,
    template: purpose,
    data: { nome: user.nome, link: buildLink(config, purpose, token) },
    emailTokenId: id,
  });
}

/** Executa o trabalho em uma transação, aninhada (savepoint) quando já houver uma em andamento. */
async function inTransaction(db: Db | Tx, work: (tx: Tx) => Promise<void>): Promise<void> {
  await db.transaction(work);
}

/**
 * Reenvia o link pedido por uma rota pública, a não ser que outro link aberto da mesma finalidade tenha saído
 * há menos de 10 minutos; assim um terceiro não invalida o link do dono nem enche a caixa dele.
 */
export async function resendPublicLink(
  db: Db | Tx,
  config: LinkConfig,
  userId: string,
  purpose: EmailTokenPurpose,
  now: Date = new Date(),
): Promise<void> {
  const since = new Date(now.getTime() - PUBLIC_RESEND_COOLDOWN_MS);
  if (await hasOpenTokenSince(db, userId, purpose, since, now)) return;
  await inTransaction(db, (tx) => sendTokenEmail(tx, config, userId, purpose));
}

/** Enfileira o e-mail de convite para o usuário. */
export function sendInvite(db: Db | Tx, config: LinkConfig, userId: string): Promise<void> {
  return inTransaction(db, (tx) => sendTokenEmail(tx, config, userId, 'convite'));
}

/** Enfileira o e-mail de redefinição de senha para o usuário. */
export function sendPasswordReset(db: Db | Tx, config: LinkConfig, userId: string): Promise<void> {
  return inTransaction(db, (tx) => sendTokenEmail(tx, config, userId, 'redefinicao'));
}
