import type { FastifyRequest } from 'fastify';
import type { ApplicationInput, DiagnosticInput, UserStatus } from '@fixable/shared';
import type { Config } from './config.types.ts';
import type { Db } from './db.types.ts';

export type PublicConfig = Pick<Config, 'APP_ORIGIN' | 'TEAM_EMAIL' | 'PUBLIC_FORM_RATE_LIMIT'>;
export type PublicDeps = { db: Db; config: PublicConfig };

export type DiagnosticRequest = FastifyRequest<{ Body: DiagnosticInput }>;
export type ApplicationRequest = FastifyRequest<{ Body: ApplicationInput }>;

export type EngineerRef = { id: string; nome: string };
export type LeadAssignment = { clientId: string | null; engineer: EngineerRef | null };

export type ExistingAccount = { userId: string; role: string; status: UserStatus; nome: string; email: string };
export type ExistingClient = { clientId: string; engineer: EngineerRef | null };
