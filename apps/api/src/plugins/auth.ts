import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@fixable/shared';
import type { Config } from '../config.ts';
import type { Db } from '../db/client.ts';
import { findSessionUser, SESSION_COOKIE, setSessionCookie, type SessionUser } from '../modules/auth/sessions.ts';
import { AppError, FORBIDDEN_MESSAGE } from './errors.ts';

type PreHandler = (request: FastifyRequest, reply: FastifyReply, done: (error?: Error) => void) => void;

const UNAUTHENTICATED = () => new AppError(401, 'unauthorized', 'Faça login para continuar.');
const FORBIDDEN = () => new AppError(403, 'forbidden', FORBIDDEN_MESSAGE);

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
  }
  interface FastifyInstance {
    requireAuth: PreHandler;
    requireRole: (...roles: Role[]) => PreHandler;
  }
}

export function registerAuth(app: FastifyInstance, deps: { db: Db; config: Pick<Config, 'COOKIE_SECURE'> }): void {
  app.decorateRequest('user', null);

  app.addHook('onRequest', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (!token) return;
    const lookup = await findSessionUser(deps.db, token);
    if (!lookup) return;
    request.user = lookup.user;
    if (lookup.renewedExpiresAt) {
      setSessionCookie(reply, token, lookup.renewedExpiresAt, deps.config.COOKIE_SECURE);
    }
  });

  const requireAuth: PreHandler = (request, _reply, done) => done(request.user ? undefined : UNAUTHENTICATED());
  app.decorate('requireAuth', requireAuth);

  app.decorate('requireRole', (...roles: Role[]): PreHandler => (request, _reply, done) => {
    if (!request.user) return done(UNAUTHENTICATED());
    done(roles.includes(request.user.role) ? undefined : FORBIDDEN());
  });
}
