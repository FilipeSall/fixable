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
import type { Db } from '../types/db.types.ts';

const LOGIN_WINDOW = '15 minutes';
const LOGIN_MAX_ATTEMPTS = 10;
const TOKEN_WINDOW = '15 minutes';
const TOKEN_MAX_REQUESTS = 20;
const FORGOT_WINDOW = '1 hour';
const FORGOT_MAX_REQUESTS = 5;

const tokenRateLimit = {
  rateLimit: { max: TOKEN_MAX_REQUESTS, timeWindow: TOKEN_WINDOW, keyGenerator: (request: { ip: string }) => request.ip },
};

/** Declara as rotas de autenticação com schema, rate limit e o controller correspondente. */
export function authRoutes(deps: { db: Db; config: Pick<Config, 'COOKIE_SECURE' | 'APP_ORIGIN'> }) {
  return (instance: FastifyInstance, _options: object, done: () => void): void => {
    const app = instance.withTypeProvider<ZodTypeProvider>();
    const controller = createAuthController(deps);

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
      controller.login,
    );

    app.post('/auth/logout', controller.logout);

    app.post(
      '/auth/tokens/lookup',
      { config: tokenRateLimit, schema: { body: tokenLookupInput, response: { 200: tokenInfoResponse } } },
      controller.tokenLookup,
    );

    app.post(
      '/auth/invite/accept',
      { config: tokenRateLimit, schema: { body: setPasswordInput, response: { 200: meResponse } } },
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
      { config: tokenRateLimit, schema: { body: setPasswordInput } },
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
