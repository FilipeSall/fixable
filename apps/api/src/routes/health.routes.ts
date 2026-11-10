import type { FastifyInstance } from 'fastify';
import { createHealthController } from '../controllers/health.controller.ts';
import type { Db } from '../db/client.ts';

export function healthRoutes(deps: { db: Db }) {
  return (instance: FastifyInstance, _options: object, done: () => void): void => {
    const controller = createHealthController(deps);
    instance.get('/health', controller.check);
    done();
  };
}
