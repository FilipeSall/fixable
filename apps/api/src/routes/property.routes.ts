import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { idParams, propertyAttribute, propertyAttributeInput, propertyAttributeParams } from '@fixable/shared';
import { createPropertyController } from '../controllers/property.controller.ts';
import type { PlatformDeps } from '../types/platform.types.ts';

/** Declara as rotas dos dados da residência de um imóvel. */
export function propertyRoutes(deps: PlatformDeps) {
  return (instance: FastifyInstance, _options: object, done: () => void): void => {
    const app = instance.withTypeProvider<ZodTypeProvider>();
    const controller = createPropertyController(deps);
    const auth = { preHandler: [instance.requireAuth] };

    app.get(
      '/properties/:id/attributes',
      { ...auth, schema: { params: idParams, response: { 200: z.array(propertyAttribute) } } },
      controller.listAttributes,
    );

    app.post(
      '/properties/:id/attributes',
      { ...auth, schema: { params: idParams, body: propertyAttributeInput, response: { 201: propertyAttribute } } },
      controller.addAttribute,
    );

    app.patch(
      '/properties/:id/attributes/:attrId',
      {
        ...auth,
        schema: { params: propertyAttributeParams, body: propertyAttributeInput, response: { 200: propertyAttribute } },
      },
      controller.updateAttribute,
    );

    app.delete(
      '/properties/:id/attributes/:attrId',
      { ...auth, schema: { params: propertyAttributeParams } },
      controller.deleteAttribute,
    );
    done();
  };
}
