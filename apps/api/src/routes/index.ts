import type { FastifyInstance } from 'fastify';
import type { Config } from '../types/config.types.ts';
import type { Db } from '../types/db.types.ts';
import { authRoutes } from './auth.routes.ts';
import { healthRoutes } from './health.routes.ts';

/** Registra todas as rotas da API. */
export function routes(deps: { db: Db; config: Pick<Config, 'COOKIE_SECURE' | 'APP_ORIGIN'> }) {
  return (api: FastifyInstance, _options: object, done: () => void): void => {
    void api.register(authRoutes(deps));
    void api.register(healthRoutes(deps));
    done();
  };
}
