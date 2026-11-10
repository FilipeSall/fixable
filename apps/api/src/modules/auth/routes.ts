import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { forgotPasswordInput, loginInput, meResponse, setPasswordInput, tokenInfoResponse } from '@fixable/shared';
import { z } from 'zod';
import type { Config } from '../../config.ts';
import type { Db } from '../../db/client.ts';
import { users } from '../../db/schema/index.ts';
import { AppError } from '../../plugins/errors.ts';
import { consumeEmailToken, peekEmailToken, type EmailTokenPurpose } from './email-tokens.ts';
import { sendInvite, sendPasswordReset } from './invites.ts';
import { hashPassword, verifyPassword } from './passwords.ts';
import {
  clearSessionCookie,
  createSession,
  revokeSession,
  revokeUserSessions,
  SESSION_COOKIE,
  setSessionCookie,
} from './sessions.ts';

const LOGIN_WINDOW = '15 minutes';
const LOGIN_MAX_ATTEMPTS = 10;
const TOKEN_WINDOW = '15 minutes';
const TOKEN_MAX_REQUESTS = 20;
const FORGOT_WINDOW = '1 hour';
const FORGOT_MAX_REQUESTS = 5;
const DUMMY_PASSWORD_HASH = await hashPassword('senha-inexistente-0');

const tokenRateLimit = {
  rateLimit: { max: TOKEN_MAX_REQUESTS, timeWindow: TOKEN_WINDOW, keyGenerator: (request: { ip: string }) => request.ip },
};

function tokenInvalid(): AppError {
  return new AppError(410, 'token_invalid', 'Este link expirou ou já foi usado.');
}

function invalidCredentials(): AppError {
  return new AppError(401, 'invalid_credentials', 'E-mail ou senha incorretos.');
}

export function authRoutes(deps: { db: Db; config: Pick<Config, 'COOKIE_SECURE' | 'APP_ORIGIN'> }) {
  const { db, config } = deps;

  return (instance: FastifyInstance, _options: object, done: () => void): void => {
    const app = instance.withTypeProvider<ZodTypeProvider>();

    async function requireLivePurpose(token: string, purpose: EmailTokenPurpose): Promise<void> {
      const info = await peekEmailToken(db, token);
      if (info?.purpose !== purpose) throw tokenInvalid();
    }

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
      '/auth/tokens/:token',
      { schema: { params: z.object({ token: z.string().min(1) }), response: { 200: tokenInfoResponse } } },
      async (request) => {
        const info = await peekEmailToken(db, request.params.token);
        if (!info) throw tokenInvalid();
        return { purpose: info.purpose, nome: info.nome, email: info.email };
      },
    );

    app.post(
      '/auth/invite/accept',
      { config: tokenRateLimit, schema: { body: setPasswordInput, response: { 200: meResponse } } },
      async (request, reply) => {
        const { token, senha } = request.body;
        await requireLivePurpose(token, 'convite');
        const passwordHash = await hashPassword(senha);
        const outcome = await db.transaction(async (tx) => {
          const consumed = await consumeEmailToken(tx, token, 'convite');
          if (!consumed) return null;
          const [user] = await tx.select().from(users).where(eq(users.id, consumed.userId)).for('update');
          if (!user) return null;
          if (user.status === 'bloqueado') return { blocked: true as const };
          await tx
            .update(users)
            .set({ passwordHash, status: 'ativo', updatedAt: new Date() })
            .where(eq(users.id, user.id));
          const session = await createSession(tx, user.id);
          return { blocked: false as const, user, session };
        });

        if (!outcome) throw tokenInvalid();
        if (outcome.blocked) {
          throw new AppError(403, 'account_blocked', 'Sua conta está bloqueada. Fale com a Fixable.');
        }
        setSessionCookie(reply, outcome.session.token, outcome.session.expiresAt, config.COOKIE_SECURE);
        const { id, nome, email, role } = outcome.user;
        return { id, nome, email, role };
      },
    );

    app.post(
      '/auth/password/forgot',
      {
        config: {
          rateLimit: {
            max: FORGOT_MAX_REQUESTS,
            timeWindow: FORGOT_WINDOW,
            keyGenerator: (request) => request.ip,
          },
        },
        schema: { body: forgotPasswordInput },
      },
      async (request, reply) => {
        const [user] = await db.select().from(users).where(eq(users.email, request.body.email)).limit(1);
        if (user?.status === 'ativo') await sendPasswordReset(db, config, user.id);
        if (user?.status === 'convidado') await sendInvite(db, config, user.id);
        return reply.status(204).send();
      },
    );

    app.post('/auth/password/reset', { config: tokenRateLimit, schema: { body: setPasswordInput } }, async (request, reply) => {
      const { token, senha } = request.body;
      await requireLivePurpose(token, 'redefinicao');
      const passwordHash = await hashPassword(senha);
      const done = await db.transaction(async (tx) => {
        const consumed = await consumeEmailToken(tx, token, 'redefinicao');
        if (!consumed) return false;
        await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, consumed.userId));
        await revokeUserSessions(tx, consumed.userId);
        return true;
      });
      if (!done) throw tokenInvalid();
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
