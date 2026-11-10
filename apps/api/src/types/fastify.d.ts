import type { Role } from '@fixable/shared';
import type { PreHandler, SessionUser } from './auth.types.ts';

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
  }
  interface FastifyInstance {
    requireAuth: PreHandler;
    requireRole: (...roles: Role[]) => PreHandler;
  }
}
