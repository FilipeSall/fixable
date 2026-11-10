import cookie from '@fastify/cookie';
import { sql } from 'drizzle-orm';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { Config } from './config.ts';
import type { Db } from './db/client.ts';
import type { Mailer } from './modules/mail/mailer.ts';
import { registerErrorHandler } from './plugins/errors.ts';

export type AppDeps = { config: Config; db: Db; mailer: Mailer };

export async function buildApp({ config, db }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: config.NODE_ENV !== 'test' });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  await app.register(cookie);

  await app.register(
    (api) => {
      api.get('/health', async (_request, reply) => {
        try {
          await db.execute(sql`select 1`);
          return { status: 'ok', db: 'ok' };
        } catch {
          return reply.status(503).send({ status: 'degraded', db: 'down' });
        }
      });
    },
    { prefix: '/api' },
  );

  return app;
}
