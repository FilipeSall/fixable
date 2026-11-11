import type { FastifyReply, FastifyRequest } from 'fastify';
import type {
  forgotPasswordInput,
  loginInput,
  Me,
  Role,
  setPasswordInput,
  tokenLookupInput,
} from '@fixable/shared';
import type { z } from 'zod';
import type { users } from '../models/index.ts';
import type { Config } from './config.types.ts';
import type { Db } from './db.types.ts';

export type SessionUser = {
  id: string;
  nome: string;
  email: string;
  role: Role;
  isDemo: boolean;
  sessionId: string;
};

export type SessionLookup = { user: SessionUser; renewedExpiresAt: Date | null };

export type PreHandler = (request: FastifyRequest, reply: FastifyReply, done: (error?: Error) => void) => void;

export type UserRow = typeof users.$inferSelect;

export type VerifiedLogin = { user: UserRow; passwordHash: string };

export type SessionGrant = { user: Me; session: { token: string; expiresAt: Date } };

export type AuthDeps = { db: Db; config: Pick<Config, 'COOKIE_SECURE' | 'APP_ORIGIN' | 'DEMO_MODE'> };
export type LoginRequest = FastifyRequest<{ Body: z.infer<typeof loginInput> }>;
export type SetPasswordRequest = FastifyRequest<{ Body: z.infer<typeof setPasswordInput> }>;
export type ForgotPasswordRequest = FastifyRequest<{ Body: z.infer<typeof forgotPasswordInput> }>;
export type TokenLookupRequest = FastifyRequest<{ Body: z.infer<typeof tokenLookupInput> }>;
