import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  clientDetail,
  clientListResponse,
  idParams,
  meClientResponse,
  propertyInput,
  propertySummary,
} from '@fixable/shared';
import { createClientController } from '../controllers/client.controller.ts';
import type { PlatformDeps } from '../types/platform.types.ts';

/** Declara as rotas de clientes: cadastro do cliente logado, lista, detalhe e criação de imóvel. */
export function clientRoutes(deps: PlatformDeps) {
  return (instance: FastifyInstance, _options: object, done: () => void): void => {
    const app = instance.withTypeProvider<ZodTypeProvider>();
    const controller = createClientController(deps);

    app.get(
      '/me/client',
      { preHandler: [instance.requireRole('cliente')], schema: { response: { 200: meClientResponse } } },
      controller.me,
    );

    app.get(
      '/clients',
      {
        preHandler: [instance.requireRole('engenheiro', 'admin')],
        schema: { response: { 200: clientListResponse } },
      },
      controller.list,
    );

    app.get(
      '/clients/:id',
      { preHandler: [instance.requireAuth], schema: { params: idParams, response: { 200: clientDetail } } },
      controller.detail,
    );

    app.post(
      '/clients/:id/properties',
      {
        preHandler: [instance.requireAuth],
        schema: { params: idParams, body: propertyInput, response: { 201: propertySummary } },
      },
      controller.createProperty,
    );
    done();
  };
}
