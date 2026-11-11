import type { FastifyReply } from 'fastify';
import type { HistoryItem, Service } from '@fixable/shared';
import * as roomServiceService from '../services/room-service.service.ts';
import type {
  CreateServiceRequest,
  IdRequest,
  MaqueteDeps,
  UpdateServiceRequest,
} from '../types/maquete.types.ts';

/** Cria o controller dos serviços dos cômodos: cadastro, edição, conclusão e histórico de manutenção. */
export function createRoomServiceController({ db, clock }: MaqueteDeps) {
  return {
    create: async (request: CreateServiceRequest, reply: FastifyReply): Promise<Service> => {
      const service = await roomServiceService.createService(db, clock, request.user!, request.params.id, request.body);
      reply.status(201);
      return service;
    },

    update: (request: UpdateServiceRequest): Promise<Service> => {
      return roomServiceService.updateService(db, clock, request.user!, request.params.id, request.body);
    },

    complete: (request: IdRequest): Promise<Service> => {
      return roomServiceService.completeService(db, clock, request.user!, request.params.id);
    },

    history: (request: IdRequest): Promise<HistoryItem[]> => {
      return roomServiceService.listHistory(db, request.user!, request.params.id);
    },
  };
}
