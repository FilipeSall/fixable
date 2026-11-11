import type { FastifyReply } from 'fastify';
import type { ServiceRequest } from '@fixable/shared';
import * as serviceRequestService from '../services/service-request.service.ts';
import type { ClientIdRequest, PlatformDeps } from '../types/platform.types.ts';
import type {
  CreateServiceRequestRequest,
  UpdateServiceRequestRequest,
} from '../types/service-request.types.ts';

/** Cria o controller das solicitações do cliente: listagem, cadastro, edição e exclusão. */
export function createServiceRequestController({ db }: PlatformDeps) {
  return {
    list: (request: ClientIdRequest): Promise<ServiceRequest[]> => {
      return serviceRequestService.listRequests(db, request.user!, request.params.id);
    },

    create: async (request: CreateServiceRequestRequest, reply: FastifyReply): Promise<ServiceRequest> => {
      const created = await serviceRequestService.createRequest(db, request.user!, request.params.id, request.body);
      reply.status(201);
      return created;
    },

    update: (request: UpdateServiceRequestRequest): Promise<ServiceRequest> => {
      return serviceRequestService.updateRequest(db, request.user!, request.params.id, request.body);
    },

    remove: async (request: ClientIdRequest, reply: FastifyReply): Promise<FastifyReply> => {
      await serviceRequestService.deleteRequest(db, request.user!, request.params.id);
      return reply.status(204).send();
    },
  };
}
