import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { applicationInput, diagnosticInput } from '@fixable/shared';
import { createPublicController } from '../controllers/public.controller.ts';
import type { PublicDeps } from '../types/public.types.ts';

const PUBLIC_FORM_WINDOW = '15 minutes';
const PUBLIC_FORM_MAX_REQUESTS = 5;

const publicFormRateLimit = {
  rateLimit: {
    max: PUBLIC_FORM_MAX_REQUESTS,
    timeWindow: PUBLIC_FORM_WINDOW,
    keyGenerator: (request: { ip: string }) => request.ip,
  },
};

/** Declara as rotas públicas dos formulários do site, com schema e rate limit por IP. */
export function publicRoutes(deps: PublicDeps) {
  return (instance: FastifyInstance, _options: object, done: () => void): void => {
    const app = instance.withTypeProvider<ZodTypeProvider>();
    const controller = createPublicController(deps);

    app.post(
      '/public/diagnostics',
      { config: publicFormRateLimit, schema: { body: diagnosticInput } },
      controller.diagnostic,
    );

    app.post(
      '/public/applications',
      { config: publicFormRateLimit, schema: { body: applicationInput } },
      controller.application,
    );
    done();
  };
}
