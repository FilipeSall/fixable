import { eq } from 'drizzle-orm';
import type { Config } from '../../config.ts';
import type { Db, Tx } from '../../db/client.ts';
import { users } from '../../db/schema/index.ts';
import { enqueueEmail } from '../mail/outbox.ts';
import { issueEmailToken, type EmailTokenPurpose } from './email-tokens.ts';

type LinkConfig = Pick<Config, 'APP_ORIGIN'>;

const LINK_PATHS: Record<EmailTokenPurpose, string> = {
  convite: '/app/convite',
  redefinicao: '/app/redefinir-senha',
};

function buildLink(config: LinkConfig, purpose: EmailTokenPurpose, token: string): string {
  const url = new URL(LINK_PATHS[purpose], config.APP_ORIGIN);
  url.searchParams.set('token', token);
  return url.toString();
}

async function sendTokenEmail(
  db: Db | Tx,
  config: LinkConfig,
  userId: string,
  purpose: EmailTokenPurpose,
): Promise<void> {
  const [user] = await db.select({ nome: users.nome, email: users.email }).from(users).where(eq(users.id, userId));
  if (!user) throw new Error('Usuário não encontrado.');
  const token = await issueEmailToken(db, userId, purpose);
  await enqueueEmail(db, {
    to: user.email,
    template: purpose,
    data: { nome: user.nome, link: buildLink(config, purpose, token) },
  });
}

async function inTransaction(db: Db | Tx, work: (tx: Tx) => Promise<void>): Promise<void> {
  await db.transaction(work);
}

export function sendInvite(db: Db | Tx, config: LinkConfig, userId: string): Promise<void> {
  return inTransaction(db, (tx) => sendTokenEmail(tx, config, userId, 'convite'));
}

export function sendPasswordReset(db: Db | Tx, config: LinkConfig, userId: string): Promise<void> {
  return inTransaction(db, (tx) => sendTokenEmail(tx, config, userId, 'redefinicao'));
}
