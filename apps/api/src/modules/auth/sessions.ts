import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { FastifyReply } from 'fastify';
import type { Role } from '@fixable/shared';
import type { Db } from '../../db/client.ts';
import { sessions, users } from '../../db/schema/index.ts';

export const SESSION_COOKIE = 'fx_session';

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 30 * DAY_MS;
const RENEW_BELOW_MS = 15 * DAY_MS;

export type SessionUser = {
  id: string;
  nome: string;
  email: string;
  role: Role;
  sessionId: string;
};

export type SessionLookup = { user: SessionUser; renewedExpiresAt: Date | null };

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  db: Db,
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

export async function revokeSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function revokeUserSessions(db: Db, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date, secure: boolean): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}
