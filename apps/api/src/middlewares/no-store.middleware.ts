import type { FastifyInstance } from 'fastify';

/** Registra o hook que marca toda resposta da API como não armazenável, para dados pessoais não ficarem em cache. */
export function registerNoStore(app: FastifyInstance): void {
  app.addHook('onSend', (_request, reply, payload, done) => {
    reply.header('Cache-Control', 'no-store');
    done(null, payload);
  });
}
