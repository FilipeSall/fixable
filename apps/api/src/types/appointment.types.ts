import type { FastifyRequest } from 'fastify';
import type {
  AppointmentInput,
  AppointmentsQuery,
  AppointmentStatus,
  AppointmentUpdateInput,
  IdParams,
} from '@fixable/shared';

export type AppointmentRow = {
  id: string;
  clientId: string;
  propertyId: string;
  propertyApelido: string;
  servico: string;
  data: string;
  hora: string;
  status: AppointmentStatus;
  descricao: string | null;
};

export type ViewerAppointmentsRequest = FastifyRequest<{ Querystring: AppointmentsQuery }>;
export type ListAppointmentsRequest = FastifyRequest<{ Params: IdParams; Querystring: AppointmentsQuery }>;
export type CreateAppointmentRequest = FastifyRequest<{ Params: IdParams; Body: AppointmentInput }>;
export type UpdateAppointmentRequest = FastifyRequest<{ Params: IdParams; Body: AppointmentUpdateInput }>;
