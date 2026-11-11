import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { registerAuth } from './middlewares/auth.middleware.ts';
import { registerErrorHandler } from './middlewares/error-handler.middleware.ts';
import { registerNoStore } from './middlewares/no-store.middleware.ts';
import { registerOriginCheck } from './middlewares/origin-check.middleware.ts';
import { routes } from './routes/index.ts';
import type { AppDeps } from './types/app.types.ts';
import { serializeError, serializeRequest } from './utils/log-redaction.ts';

/** Confia nos `hops` saltos mais próximos da API (a conexão e os proxies seguintes) para achar o IP real do visitante. */
function trustProxyHops(hops: number) {
  return hops > 0 ? (_address: string, hop: number) => hop < hops : false;
}

/** Monta a aplicação Fastify com validação, erros, respostas sem cache, cookies, rate limit, checagem de Origin, autenticação e rotas sob /api. */
export async function buildApp({ config, db, clock = () => new Date() }: AppDeps): Promise<FastifyInstance> {
  const logger = config.NODE_ENV === 'test' ? false : { serializers: { req: serializeRequest, err: serializeError } };
  const app = Fastify({ logger, trustProxy: trustProxyHops(config.TRUST_PROXY_HOPS) });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  registerNoStore(app);
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  registerOriginCheck(app, config);
  registerAuth(app, { db, config });

  await app.register(routes({ db, config, clock }), { prefix: '/api' });

  return app;
}
