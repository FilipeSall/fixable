import { randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { Db, Tx } from '../db/client.ts';
import { sessions, users } from '../models/index.ts';
import type { SessionLookup, SessionUser } from '../types/auth.types.ts';
import { hashToken } from '../utils/token.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 30 * DAY_MS;
const RENEW_BELOW_MS = 15 * DAY_MS;

export async function createSession(
  db: Db | Tx,
  userId: string,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

export async function findSessionUser(
  db: Db,
  token: string,
  now: Date = new Date(),
): Promise<SessionLookup | null> {
  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      id: users.id,
      nome: users.nome,
      email: users.email,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, now), eq(users.status, 'ativo')))
    .limit(1);
  if (!row) return null;

  const user: SessionUser = { id: row.id, nome: row.nome, email: row.email, role: row.role, sessionId: row.sessionId };
  const renewThreshold = new Date(now.getTime() + RENEW_BELOW_MS);
  if (row.expiresAt >= renewThreshold) return { user, renewedExpiresAt: null };

  const renewedExpiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db
    .update(sessions)
    .set({ expiresAt: renewedExpiresAt })
    .where(and(eq(sessions.id, row.sessionId), lt(sessions.expiresAt, renewThreshold)));
  return { user, renewedExpiresAt };
}

export async function revokeSession(db: Db | Tx, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function revokeUserSessions(db: Db | Tx, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
