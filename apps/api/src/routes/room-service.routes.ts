import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { historyItem, idParams, service, serviceInput, serviceUpdateInput } from '@fixable/shared';
import { createRoomServiceController } from '../controllers/room-service.controller.ts';
import type { MaqueteDeps } from '../types/maquete.types.ts';

/** Declara as rotas dos serviços dos cômodos e do histórico de manutenção do imóvel. */
export function roomServiceRoutes(deps: MaqueteDeps) {
  return (instance: FastifyInstance, _options: object, done: () => void): void => {
    const app = instance.withTypeProvider<ZodTypeProvider>();
    const controller = createRoomServiceController(deps);
    const auth = { preHandler: [instance.requireAuth] };

    app.post(
      '/properties/:id/services',
      { ...auth, schema: { params: idParams, body: serviceInput, response: { 201: service } } },
      controller.create,
    );

    app.patch(
      '/services/:id',
      { ...auth, schema: { params: idParams, body: serviceUpdateInput, response: { 200: service } } },
      controller.update,
    );

    app.post(
      '/services/:id/complete',
      { ...auth, schema: { params: idParams, response: { 200: service } } },
      controller.complete,
    );

    app.get(
      '/properties/:id/history',
      { ...auth, schema: { params: idParams, response: { 200: z.array(historyItem) } } },
      controller.history,
    );
    done();
  };
}
