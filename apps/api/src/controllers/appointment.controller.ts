import type { FastifyReply } from 'fastify';
import type { Appointment, EngineerAppointment } from '@fixable/shared';
import * as appointmentService from '../services/appointment.service.ts';
import type {
  CreateAppointmentRequest,
  ListAppointmentsRequest,
  UpdateAppointmentRequest,
  ViewerAppointmentsRequest,
} from '../types/appointment.types.ts';
import type { ClientIdRequest, PlatformMailDeps } from '../types/platform.types.ts';

/** Cria o controller dos agendamentos: calendário da equipe, lista do mês, cadastro, edição com troca de status e exclusão. */
export function createAppointmentController(deps: PlatformMailDeps) {
  return {
    calendar: (request: ViewerAppointmentsRequest): Promise<EngineerAppointment[]> => {
      return appointmentService.listViewerAppointments(deps.db, request.user!, request.query);
    },

    list: (request: ListAppointmentsRequest): Promise<Appointment[]> => {
      return appointmentService.listAppointments(deps.db, request.user!, request.params.id, request.query);
    },

    create: async (request: CreateAppointmentRequest, reply: FastifyReply): Promise<Appointment> => {
      const created = await appointmentService.createAppointment(deps, request.user!, request.params.id, request.body);
      reply.status(201);
      return created;
    },

    update: (request: UpdateAppointmentRequest): Promise<Appointment> => {
      return appointmentService.updateAppointment(deps, request.user!, request.params.id, request.body);
    },

    remove: async (request: ClientIdRequest, reply: FastifyReply): Promise<FastifyReply> => {
      await appointmentService.deleteAppointment(deps.db, request.user!, request.params.id);
      return reply.status(204).send();
    },
  };
}
