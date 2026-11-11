import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ClientDetail, ClientListResponse, PropertySummary } from '@fixable/shared';
import * as clientService from '../services/client.service.ts';
import { createProperty } from '../services/property.service.ts';
import type { ClientIdRequest, CreatePropertyRequest, PlatformDeps } from '../types/platform.types.ts';

/** Cria o controller de clientes com o cadastro do cliente logado, a lista, o detalhe e a criação de imóvel. */
export function createClientController({ db }: PlatformDeps) {
  return {
    me: (request: FastifyRequest): Promise<{ clientId: string }> => {
      return clientService.findMyClientId(db, request.user!);
    },

    list: (request: FastifyRequest): Promise<ClientListResponse> => {
      return clientService.listClients(db, request.user!);
    },

    detail: (request: ClientIdRequest): Promise<ClientDetail> => {
      return clientService.getClientDetail(db, request.user!, request.params.id);
    },

    createProperty: async (request: CreatePropertyRequest, reply: FastifyReply): Promise<PropertySummary> => {
      const property = await createProperty(db, request.user!, request.params.id, request.body);
      reply.status(201);
      return property;
    },
  };
}
