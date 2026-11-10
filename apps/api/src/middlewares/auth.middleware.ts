import type { FastifyInstance } from 'fastify';
import type { Role } from '@fixable/shared';
import type { Config } from '../types/config.types.ts';
import type { Db } from '../types/db.types.ts';
import { findSessionUser } from '../services/session.service.ts';
import type { PreHandler } from '../types/auth.types.ts';
import { AppError, FORBIDDEN_MESSAGE, UNAUTHORIZED_MESSAGE } from '../utils/app-error.ts';
import { SESSION_COOKIE, setSessionCookie } from '../utils/session-cookie.ts';

/** Cria o erro 401 usado quando não há usuário autenticado. */
const UNAUTHENTICATED = () => new AppError(401, 'unauthorized', UNAUTHORIZED_MESSAGE);
/** Cria o erro 403 usado quando o papel do usuário não permite o acesso. */
const FORBIDDEN = () => new AppError(403, 'forbidden', FORBIDDEN_MESSAGE);

/** Registra a leitura da sessão pelo cookie e os decorators requireAuth e requireRole. */
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

  /** Pre-handler que recusa a requisição quando não há usuário autenticado. */
  const requireAuth: PreHandler = (request, _reply, done) => done(request.user ? undefined : UNAUTHENTICATED());
  app.decorate('requireAuth', requireAuth);

  app.decorate('requireRole', (...roles: Role[]): PreHandler => (request, _reply, done) => {
    if (!request.user) return done(UNAUTHENTICATED());
    done(roles.includes(request.user.role) ? undefined : FORBIDDEN());
  });
}
