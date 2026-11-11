import { randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Db, Tx } from '../types/db.types.ts';
import { emailTokens, users } from '../models/index.ts';
import type { EmailTokenPurpose } from '../types/email-token.types.ts';
import { hashToken } from '../utils/token.ts';

const HOUR_MS = 60 * 60 * 1000;
const TOKEN_TTL_MS: Record<EmailTokenPurpose, number> = {
  convite: 48 * HOUR_MS,
  redefinicao: HOUR_MS,
};

/** Emite um link novo para o usuário, invalidando os anteriores da mesma finalidade, e devolve o token em claro. */
export async function issueEmailToken(
  db: Db | Tx,
  userId: string,
  purpose: EmailTokenPurpose,
  now: Date = new Date(),
): Promise<{ id: string; token: string }> {
  await db
    .update(emailTokens)
    .set({ usedAt: now })
    .where(and(eq(emailTokens.userId, userId), eq(emailTokens.purpose, purpose), isNull(emailTokens.usedAt)));

  const token = randomBytes(32).toString('base64url');
  const [row] = await db
    .insert(emailTokens)
    .values({
      userId,
      purpose,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[purpose]),
    })
    .returning({ id: emailTokens.id });
  return { id: row!.id, token };
}

/** Diz se o usuário tem um link aberto da finalidade emitido depois do instante informado. */
export async function hasOpenTokenSince(
  db: Db | Tx,
  userId: string,
  purpose: EmailTokenPurpose,
  since: Date,
  now: Date = new Date(),
): Promise<boolean> {
  const [row] = await db
    .select({ id: emailTokens.id })
    .from(emailTokens)
    .where(
      and(
        eq(emailTokens.userId, userId),
        eq(emailTokens.purpose, purpose),
        isNull(emailTokens.usedAt),
        gt(emailTokens.expiresAt, now),
        gt(emailTokens.createdAt, since),
      ),
    )
    .limit(1);
  return row !== undefined;
}

/** Consulta um link sem consumi-lo e devolve o dono e a finalidade se ainda estiver aberto. */
export async function peekEmailToken(
  db: Db | Tx,
  raw: string,
  now: Date = new Date(),
): Promise<{ userId: string; purpose: EmailTokenPurpose; nome: string; email: string } | null> {
  const [row] = await db
    .select({ userId: users.id, purpose: emailTokens.purpose, nome: users.nome, email: users.email })
    .from(emailTokens)
    .innerJoin(users, eq(users.id, emailTokens.userId))
    .where(and(eq(emailTokens.tokenHash, hashToken(raw)), isNull(emailTokens.usedAt), gt(emailTokens.expiresAt, now)))
    .limit(1);
  return row ?? null;
}

/** Marca como usado o link aberto do usuário e propósito informados, de forma atômica, para que valha uma vez só. */
export async function consumeEmailToken(
  db: Db | Tx,
  raw: string,
  purpose: EmailTokenPurpose,
  userId: string,
  now: Date = new Date(),
): Promise<{ userId: string } | null> {
  const [row] = await db
    .update(emailTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(emailTokens.tokenHash, hashToken(raw)),
        eq(emailTokens.purpose, purpose),
        eq(emailTokens.userId, userId),
        isNull(emailTokens.usedAt),
        gt(emailTokens.expiresAt, now),
      ),
    )
    .returning({ userId: emailTokens.userId });
  return row ?? null;
}
