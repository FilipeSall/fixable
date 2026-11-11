import type { FastifyRequest } from 'fastify';
import type {
  FloorInput,
  IdParams,
  NewFloorInput,
  RoomFieldsInput,
  ServiceInput,
  ServiceStatus,
  ServiceUpdateInput,
} from '@fixable/shared';
import type { Db } from './db.types.ts';

export type Clock = () => Date;

export type MaqueteDeps = { db: Db; clock: Clock };

export type ServiceRow = {
  id: string;
  roomId: string | null;
  titulo: string;
  descricao: string | null;
  status: ServiceStatus;
  prazo: string | null;
  percentual: number;
  concludedAt: Date | null;
};

export type HistoryRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  andar: string | null;
  comodo: string | null;
  concludedAt: Date;
};

export type ConclusionState = { status: ServiceStatus; concludedAt: Date | null; percentual: number };

export type IdRequest = FastifyRequest<{ Params: IdParams }>;
export type NewFloorRequest = FastifyRequest<{ Params: IdParams; Body: NewFloorInput | null | undefined }>;
export type RenameFloorRequest = FastifyRequest<{ Params: IdParams; Body: FloorInput }>;
export type RoomRequest = FastifyRequest<{ Params: IdParams; Body: RoomFieldsInput }>;
export type CreateServiceRequest = FastifyRequest<{ Params: IdParams; Body: ServiceInput }>;
export type UpdateServiceRequest = FastifyRequest<{ Params: IdParams; Body: ServiceUpdateInput }>;
