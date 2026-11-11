import type { FastifyInstance } from 'fastify';
import type { Config } from '../types/config.types.ts';
import type { Db } from '../types/db.types.ts';
import { authRoutes } from './auth.routes.ts';
import { clientRoutes } from './client.routes.ts';
import { healthRoutes } from './health.routes.ts';
import { propertyRoutes } from './property.routes.ts';
import { publicRoutes } from './public.routes.ts';

/** Registra todas as rotas da API. */
export function routes(deps: { db: Db; config: Pick<Config, 'COOKIE_SECURE' | 'APP_ORIGIN' | 'TEAM_EMAIL' | 'PUBLIC_FORM_RATE_LIMIT'> }) {
  return (api: FastifyInstance, _options: object, done: () => void): void => {
    void api.register(authRoutes(deps));
    void api.register(healthRoutes(deps));
    void api.register(publicRoutes(deps));
    void api.register(clientRoutes(deps));
    void api.register(propertyRoutes(deps));
    done();
  };
}
