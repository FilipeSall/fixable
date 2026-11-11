import type { FastifyReply } from 'fastify';
import type { Floor, Floorplan, Room } from '@fixable/shared';
import * as maqueteService from '../services/maquete.service.ts';
import type {
  IdRequest,
  MaqueteDeps,
  NewFloorRequest,
  RenameFloorRequest,
  RoomRequest,
} from '../types/maquete.types.ts';

/** Cria o controller da maquete: planta do imóvel, andares e cômodos. */
export function createMaqueteController({ db, clock }: MaqueteDeps) {
  return {
    floorplan: (request: IdRequest): Promise<Floorplan> => {
      return maqueteService.getFloorplan(db, clock, request.user!, request.params.id);
    },

    createFloor: async (request: NewFloorRequest, reply: FastifyReply): Promise<Floor> => {
      const floor = await maqueteService.createFloor(db, request.user!, request.params.id, request.body);
      reply.status(201);
      return floor;
    },

    renameFloor: (request: RenameFloorRequest): Promise<Floor> => {
      return maqueteService.renameFloor(db, request.user!, request.params.id, request.body);
    },

    deleteFloor: async (request: IdRequest, reply: FastifyReply): Promise<FastifyReply> => {
      await maqueteService.deleteFloor(db, request.user!, request.params.id);
      return reply.status(204).send();
    },

    createRoom: async (request: RoomRequest, reply: FastifyReply): Promise<Room> => {
      const room = await maqueteService.createRoom(db, request.user!, request.params.id, request.body);
      reply.status(201);
      return room;
    },

    updateRoom: (request: RoomRequest): Promise<Room> => {
      return maqueteService.updateRoom(db, request.user!, request.params.id, request.body);
    },

    deleteRoom: async (request: IdRequest, reply: FastifyReply): Promise<FastifyReply> => {
      await maqueteService.deleteRoom(db, request.user!, request.params.id);
      return reply.status(204).send();
    },
  };
}
