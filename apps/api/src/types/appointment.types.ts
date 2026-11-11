import type { FastifyRequest } from 'fastify';
import type {
  AppointmentInput,
  AppointmentsQuery,
  AppointmentStatus,
  AppointmentUpdateInput,
  IdParams,
} from '@fixable/shared';
import type { Config } from './config.types.ts';
import type { Db } from './db.types.ts';

export type AppointmentDeps = { db: Db; config: Pick<Config, 'APP_ORIGIN'> };

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

export type ListAppointmentsRequest = FastifyRequest<{ Params: IdParams; Querystring: AppointmentsQuery }>;
export type CreateAppointmentRequest = FastifyRequest<{ Params: IdParams; Body: AppointmentInput }>;
export type UpdateAppointmentRequest = FastifyRequest<{ Params: IdParams; Body: AppointmentUpdateInput }>;
