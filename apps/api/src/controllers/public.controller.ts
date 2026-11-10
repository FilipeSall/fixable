import type { FastifyReply } from 'fastify';
import { submitApplication } from '../services/application.service.ts';
import { submitDiagnostic } from '../services/diagnostic.service.ts';
import type { ApplicationRequest, DiagnosticRequest, PublicDeps } from '../types/public.types.ts';

/** Informa se o campo-armadilha do formulário veio preenchido, sinal de envio automatizado. */
const isBot = (website: string | undefined): boolean => Boolean(website);

/** Cria o controller dos formulários públicos de diagnóstico e candidatura, que sempre respondem 204. */
export function createPublicController({ db, config }: PublicDeps) {
  return {
    diagnostic: async (request: DiagnosticRequest, reply: FastifyReply): Promise<FastifyReply> => {
      if (!isBot(request.body.website)) await submitDiagnostic(db, config, request.body);
      return reply.status(204).send();
    },

    application: async (request: ApplicationRequest, reply: FastifyReply): Promise<FastifyReply> => {
      if (!isBot(request.body.website)) await submitApplication(db, config, request.body);
      return reply.status(204).send();
    },
  };
}
