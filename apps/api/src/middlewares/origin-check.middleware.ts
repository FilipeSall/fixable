import type { FastifyInstance } from 'fastify';
import type { Config } from '../types/config.types.ts';
import { AppError, FORBIDDEN_MESSAGE } from '../utils/app-error.ts';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Registra o hook que recusa métodos que alteram dados quando o Origin não é o do site. */
export function registerOriginCheck(app: FastifyInstance, config: Pick<Config, 'APP_ORIGIN'>): void {
  const allowedOrigin = new URL(config.APP_ORIGIN).origin;
  app.addHook('onRequest', (request, _reply, done) => {
    if (!UNSAFE_METHODS.has(request.method)) return done();
    if (request.headers.origin !== allowedOrigin) {
      return done(new AppError(403, 'forbidden', FORBIDDEN_MESSAGE));
    }
    done();
  });
}
