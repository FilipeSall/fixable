import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { floor, floorInput, floorplan, idParams, newFloorInput, room, roomFieldsInput } from '@fixable/shared';
import { createMaqueteController } from '../controllers/maquete.controller.ts';
import type { MaqueteDeps } from '../types/maquete.types.ts';

/** Declara as rotas da maquete: planta do imóvel, andares e cômodos. */
export function maqueteRoutes(deps: MaqueteDeps) {
  return (instance: FastifyInstance, _options: object, done: () => void): void => {
    const app = instance.withTypeProvider<ZodTypeProvider>();
    const controller = createMaqueteController(deps);
    const auth = { preHandler: [instance.requireAuth] };

    app.get(
      '/properties/:id/floorplan',
      { ...auth, schema: { params: idParams, response: { 200: floorplan } } },
      controller.floorplan,
    );

    app.post(
      '/properties/:id/floors',
      { ...auth, schema: { params: idParams, body: newFloorInput.nullish(), response: { 201: floor } } },
      controller.createFloor,
    );

    app.patch(
      '/floors/:id',
      { ...auth, schema: { params: idParams, body: floorInput, response: { 200: floor } } },
      controller.renameFloor,
    );

    app.delete('/floors/:id', { ...auth, schema: { params: idParams } }, controller.deleteFloor);

    app.post(
      '/floors/:id/rooms',
      { ...auth, schema: { params: idParams, body: roomFieldsInput, response: { 201: room } } },
      controller.createRoom,
    );

    app.patch(
      '/rooms/:id',
      { ...auth, schema: { params: idParams, body: roomFieldsInput, response: { 200: room } } },
      controller.updateRoom,
    );

    app.delete('/rooms/:id', { ...auth, schema: { params: idParams } }, controller.deleteRoom);
    done();
  };
}
