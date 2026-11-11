import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { applicationInput, diagnosticInput } from '@fixable/shared';
import { createPublicController } from '../controllers/public.controller.ts';
import type { PublicDeps } from '../types/public.types.ts';

const PUBLIC_FORM_WINDOW = '15 minutes';

/** Monta o rate limit por IP dos formulários públicos com o máximo de envios por janela vindo da configuração. */
function publicFormRateLimit(max: number) {
  return {
    rateLimit: {
      max,
      timeWindow: PUBLIC_FORM_WINDOW,
      keyGenerator: (request: { ip: string }) => request.ip,
    },
  };
}

/** Declara as rotas públicas dos formulários do site, com schema e rate limit por IP. */
export function publicRoutes(deps: PublicDeps) {
  return (instance: FastifyInstance, _options: object, done: () => void): void => {
    const app = instance.withTypeProvider<ZodTypeProvider>();
    const controller = createPublicController(deps);
    const rateLimit = publicFormRateLimit(deps.config.PUBLIC_FORM_RATE_LIMIT);

    app.post(
      '/public/diagnostics',
      { config: rateLimit, schema: { body: diagnosticInput } },
      controller.diagnostic,
    );

    app.post(
      '/public/applications',
      { config: rateLimit, schema: { body: applicationInput } },
      controller.application,
    );
    done();
  };
}
