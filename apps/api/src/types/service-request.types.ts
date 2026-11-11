import type { FastifyRequest } from 'fastify';
import type { IdParams, ServiceRequestInput, ServiceRequestStatus, ServiceRequestUpdateInput } from '@fixable/shared';

export type ServiceRequestRow = {
  id: string;
  descricao: string;
  status: ServiceRequestStatus;
  propertyId: string | null;
  propertyApelido: string | null;
  createdAt: Date;
};

export type CreateServiceRequestRequest = FastifyRequest<{ Params: IdParams; Body: ServiceRequestInput }>;
export type UpdateServiceRequestRequest = FastifyRequest<{ Params: IdParams; Body: ServiceRequestUpdateInput }>;
