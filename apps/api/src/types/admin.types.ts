import type { FastifyRequest } from 'fastify';
import type {
  AdminApplicationsQuery,
  AdminLeadsQuery,
  ApplicationArea,
  ApplicationStatus,
  IdParams,
  PlanId,
  PropertyType,
  TeamInviteInput,
} from '@fixable/shared';

export type LeadRow = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  tipoImovel: PropertyType;
  plano: PlanId | null;
  engenheiro: string | null;
  createdAt: Date;
};

export type ApplicationRow = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  area: ApplicationArea;
  status: ApplicationStatus;
  createdAt: Date;
};

export type AdminLeadsRequest = FastifyRequest<{ Querystring: AdminLeadsQuery }>;
export type AdminApplicationsRequest = FastifyRequest<{ Querystring: AdminApplicationsQuery }>;
export type AdminApplicationRequest = FastifyRequest<{ Params: IdParams }>;
export type TeamInviteRequest = FastifyRequest<{ Body: TeamInviteInput }>;
