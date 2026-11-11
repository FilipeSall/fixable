import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  forgotPasswordInput,
  loginInput,
  meResponse,
  setPasswordInput,
  tokenInfoResponse,
  tokenLookupInput,
} from '@fixable/shared';
import type { Config } from '../types/config.types.ts';
import { createAuthController } from '../controllers/auth.controller.ts';
import { emailRateLimit } from '../middlewares/email-rate-limit.middleware.ts';
import type { Db } from '../types/db.types.ts';

const LOGIN_WINDOW = '15 minutes';
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_LIMIT_FACTOR = 2;
const TOKEN_WINDOW = '15 minutes';
const FORGOT_WINDOW = '1 hour';
const FORGOT_MAX_REQUESTS = 5;

/** Monta o rate limit por IP dos endpoints que recebem token, com o máximo vindo da configuração. */
function tokenRateLimit(max: number) {
  return {
    rateLimit: { max, timeWindow: TOKEN_WINDOW, keyGenerator: (request: { ip: string }) => request.ip },
  };
}

/** Declara as rotas de autenticação com schema, rate limit e o controller correspondente. */
export function authRoutes(deps: {
  db: Db;
  config: Pick<Config, 'COOKIE_SECURE' | 'APP_ORIGIN' | 'TOKEN_RATE_LIMIT' | 'LOGIN_RATE_LIMIT' | 'DEMO_MODE'>;
}) {
  return (instance: FastifyInstance, _options: object, done: () => void): void => {
    const app = instance.withTypeProvider<ZodTypeProvider>();
    const controller = createAuthController(deps);
    const tokenLimit = tokenRateLimit(deps.config.TOKEN_RATE_LIMIT);

    app.post(
      '/auth/login',
      {
        preHandler: [
          emailRateLimit(instance, {
            prefix: 'login',
            max: deps.config.LOGIN_RATE_LIMIT * EMAIL_LIMIT_FACTOR,
            timeWindowMs: LOGIN_WINDOW_MS,
          }),
        ],
        config: {
          rateLimit: {
            max: deps.config.LOGIN_RATE_LIMIT,
            timeWindow: LOGIN_WINDOW,
            keyGenerator: (request) => request.ip,
          },
        },
        schema: { body: loginInput, response: { 200: meResponse } },
      },
      controller.login,
    );

    app.post('/auth/logout', controller.logout);

    app.post(
      '/auth/tokens/lookup',
      { config: tokenLimit, schema: { body: tokenLookupInput, response: { 200: tokenInfoResponse } } },
      controller.tokenLookup,
    );

    app.post(
      '/auth/invite/accept',
      { config: tokenLimit, schema: { body: setPasswordInput, response: { 200: meResponse } } },
      controller.acceptInvite,
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
      controller.forgotPassword,
    );

    app.post(
      '/auth/password/reset',
      { config: tokenLimit, schema: { body: setPasswordInput } },
      controller.resetPassword,
    );

    app.get(
      '/auth/me',
      { preHandler: [instance.requireAuth], schema: { response: { 200: meResponse } } },
      controller.me,
    );
    done();
  };
}
