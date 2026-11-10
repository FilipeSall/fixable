import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { loginInput, meResponse } from '@fixable/shared';
import type { Config } from '../../config.ts';
import type { Db } from '../../db/client.ts';
import { users } from '../../db/schema/index.ts';
import { AppError } from '../../plugins/errors.ts';
import { hashPassword, verifyPassword } from './passwords.ts';
import {
  clearSessionCookie,
  createSession,
  revokeSession,
  SESSION_COOKIE,
  setSessionCookie,
} from './sessions.ts';

const LOGIN_WINDOW = '15 minutes';
const LOGIN_MAX_ATTEMPTS = 10;
const DUMMY_PASSWORD_HASH = await hashPassword('senha-inexistente-0');

function invalidCredentials(): AppError {
  return new AppError(401, 'invalid_credentials', 'E-mail ou senha incorretos.');
}

export function authRoutes(deps: { db: Db; config: Pick<Config, 'COOKIE_SECURE'> }) {
  const { db, config } = deps;

  return (instance: FastifyInstance, _options: object, done: () => void): void => {
    const app = instance.withTypeProvider<ZodTypeProvider>();

    app.post(
      '/auth/login',
      {
        config: {
          rateLimit: {
            max: LOGIN_MAX_ATTEMPTS,
            timeWindow: LOGIN_WINDOW,
            keyGenerator: (request) => request.ip,
          },
        },
        schema: { body: loginInput, response: { 200: meResponse } },
      },
      async (request, reply) => {
        const { email, senha } = request.body;
        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

        const passwordMatches = await verifyPassword(user?.passwordHash ?? DUMMY_PASSWORD_HASH, senha);
        if (!user?.passwordHash || !passwordMatches) throw invalidCredentials();
        if (user.status === 'bloqueado') {
          throw new AppError(403, 'account_blocked', 'Sua conta está bloqueada. Fale com a Fixable.');
        }
        if (user.status !== 'ativo') throw invalidCredentials();

        const previousToken = request.cookies[SESSION_COOKIE];
        if (previousToken) await revokeSession(db, previousToken);

        const { token, expiresAt } = await createSession(db, user.id);
        setSessionCookie(reply, token, expiresAt, config.COOKIE_SECURE);
        return { id: user.id, nome: user.nome, email: user.email, role: user.role };
      },
    );

    app.post('/auth/logout', async (request, reply) => {
      const token = request.cookies[SESSION_COOKIE];
      if (token) await revokeSession(db, token);
      clearSessionCookie(reply);
      return reply.status(204).send();
    });

    app.get(
      '/auth/me',
      { preHandler: [instance.requireAuth], schema: { response: { 200: meResponse } } },
      (request, reply) => {
        const { id, nome, email, role } = request.user!;
        void reply.send({ id, nome, email, role });
      },
    );
    done();
  };
}
