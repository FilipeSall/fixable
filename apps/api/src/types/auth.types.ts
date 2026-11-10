import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@fixable/shared';

export type SessionUser = {
  id: string;
  nome: string;
  email: string;
  role: Role;
  sessionId: string;
};

export type SessionLookup = { user: SessionUser; renewedExpiresAt: Date | null };

export type PreHandler = (request: FastifyRequest, reply: FastifyReply, done: (error?: Error) => void) => void;
