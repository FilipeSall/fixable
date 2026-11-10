import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@fixable/shared';
import type { users } from '../models/index.ts';

export type SessionUser = {
  id: string;
  nome: string;
  email: string;
  role: Role;
  sessionId: string;
};

export type SessionLookup = { user: SessionUser; renewedExpiresAt: Date | null };

export type PreHandler = (request: FastifyRequest, reply: FastifyReply, done: (error?: Error) => void) => void;

export type VerifiedLogin = { user: typeof users.$inferSelect; passwordHash: string };
