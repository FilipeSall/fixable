import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { registerAuth } from './middlewares/auth.middleware.ts';
import { registerErrorHandler } from './middlewares/error-handler.middleware.ts';
import { registerOriginCheck } from './middlewares/origin-check.middleware.ts';
import { routes } from './routes/index.ts';
import type { AppDeps } from './types/app.types.ts';
import { serializeError, serializeRequest } from './utils/log-redaction.ts';

/** Monta a aplicação Fastify com validação, erros, cookies, rate limit, checagem de Origin, autenticação e rotas sob /api. */
export async function buildApp({ config, db }: AppDeps): Promise<FastifyInstance> {
  const trustProxy = config.TRUST_PROXY ? (_address: string, hop: number) => hop === 0 : false;
  const logger = config.NODE_ENV === 'test' ? false : { serializers: { req: serializeRequest, err: serializeError } };
  const app = Fastify({ logger, trustProxy });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  registerOriginCheck(app, config);
  registerAuth(app, { db, config });

  await app.register(routes({ db, config }), { prefix: '/api' });

  return app;
}
