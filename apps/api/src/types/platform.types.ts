import type { FastifyRequest } from 'fastify';
import type {
  IdParams,
  PropertyAttributeInput,
  PropertyAttributeParams,
  PropertyInput,
  Role,
} from '@fixable/shared';
import type { Config } from './config.types.ts';
import type { Db, Tx } from './db.types.ts';

export type Queryable = Db | Tx;

export type AccessMode = 'read' | 'write';

export type Viewer = { id: string; role: Role; isDemo: boolean };

export type ClientScope = { clientId: string; engineerId: string | null };

export type PropertyScope = ClientScope & { propertyId: string };

export type PlatformDeps = { db: Db };

export type PlatformMailDeps = { db: Db; config: Pick<Config, 'APP_ORIGIN'> };

export type ClientIdRequest = FastifyRequest<{ Params: IdParams }>;
export type CreatePropertyRequest = FastifyRequest<{ Params: IdParams; Body: PropertyInput }>;
export type PropertyIdRequest = FastifyRequest<{ Params: IdParams }>;
export type CreateAttributeRequest = FastifyRequest<{ Params: IdParams; Body: PropertyAttributeInput }>;
export type UpdateAttributeRequest = FastifyRequest<{ Params: PropertyAttributeParams; Body: PropertyAttributeInput }>;
export type AttributeRequest = FastifyRequest<{ Params: PropertyAttributeParams }>;
