import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../db/client.ts';
import { isDatabaseUp } from '../services/health.service.ts';

export function createHealthController({ db }: { db: Db }) {
  return {
    check: async (_request: FastifyRequest, reply: FastifyReply) => {
      if (await isDatabaseUp(db)) return { status: 'ok', db: 'ok' };
      return reply.status(503).send({ status: 'degraded', db: 'down' });
    },
  };
}
