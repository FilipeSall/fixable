import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { idParams, serviceRequest, serviceRequestInput, serviceRequestUpdateInput } from '@fixable/shared';
import { createServiceRequestController } from '../controllers/service-request.controller.ts';
import type { PlatformDeps } from '../types/platform.types.ts';

/** Declara as rotas das solicitações do cliente. */
export function serviceRequestRoutes(deps: PlatformDeps) {
  return (instance: FastifyInstance, _options: object, done: () => void): void => {
    const app = instance.withTypeProvider<ZodTypeProvider>();
    const controller = createServiceRequestController(deps);
    const auth = { preHandler: [instance.requireAuth] };

    app.get(
      '/clients/:id/requests',
      { ...auth, schema: { params: idParams, response: { 200: z.array(serviceRequest) } } },
      controller.list,
    );

    app.post(
      '/clients/:id/requests',
      { ...auth, schema: { params: idParams, body: serviceRequestInput, response: { 201: serviceRequest } } },
      controller.create,
    );

    app.patch(
      '/requests/:id',
      { ...auth, schema: { params: idParams, body: serviceRequestUpdateInput, response: { 200: serviceRequest } } },
      controller.update,
    );

    app.delete('/requests/:id', { ...auth, schema: { params: idParams } }, controller.remove);
    done();
  };
}
