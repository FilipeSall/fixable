import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.ts';
import { AppError } from './errors.ts';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function registerOriginCheck(app: FastifyInstance, config: Pick<Config, 'APP_ORIGIN'>): void {
  const allowedOrigin = new URL(config.APP_ORIGIN).origin;
  app.addHook('onRequest', (request, _reply, done) => {
    if (!UNSAFE_METHODS.has(request.method) || !request.url.startsWith('/api')) return done();
    if (request.headers.origin !== allowedOrigin) {
      return done(new AppError(403, 'forbidden', 'Você não tem permissão para acessar este recurso.'));
    }
    done();
  });
}
