import type { FastifyInstance } from 'fastify';
import type { Config } from '../config/env.ts';
import type { Db } from '../db/client.ts';
import { authRoutes } from './auth.routes.ts';
import { healthRoutes } from './health.routes.ts';

export function routes(deps: { db: Db; config: Pick<Config, 'COOKIE_SECURE' | 'APP_ORIGIN'> }) {
  return (api: FastifyInstance, _options: object, done: () => void): void => {
    void api.register(authRoutes(deps));
    void api.register(healthRoutes(deps));
    done();
  };
}
