import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Me } from '@fixable/shared';
import * as authService from '../services/auth.service.ts';
import type {
  AuthDeps,
  ForgotPasswordRequest,
  LoginRequest,
  SetPasswordRequest,
  TokenLookupRequest,
} from '../types/auth.types.ts';
import { clearSessionCookie, SESSION_COOKIE, setSessionCookie } from '../utils/session-cookie.ts';

/** Cria o controller de autenticação com os handlers de login, logout, convite, redefinição e usuário atual. */
export function createAuthController({ db, config }: AuthDeps) {
  return {
    login: async (request: LoginRequest, reply: FastifyReply): Promise<Me> => {
      const { email, senha } = request.body;
      const { user, session } = await authService.login(db, {
        email,
        senha,
        previousToken: request.cookies[SESSION_COOKIE],
      });
      setSessionCookie(reply, session.token, session.expiresAt, config.COOKIE_SECURE);
      return user;
    },

    logout: async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
      await authService.logout(db, request.cookies[SESSION_COOKIE]);
      clearSessionCookie(reply);
      return reply.status(204).send();
    },

    tokenLookup: (request: TokenLookupRequest) => {
      return authService.getTokenInfo(db, request.body.token);
    },

    acceptInvite: async (request: SetPasswordRequest, reply: FastifyReply): Promise<Me> => {
      const { user, session } = await authService.acceptInvite(db, request.body);
      setSessionCookie(reply, session.token, session.expiresAt, config.COOKIE_SECURE);
      return user;
    },

    forgotPassword: async (request: ForgotPasswordRequest, reply: FastifyReply): Promise<FastifyReply> => {
      await authService.forgotPassword(db, config, request.body.email);
      return reply.status(204).send();
    },

    resetPassword: async (request: SetPasswordRequest, reply: FastifyReply): Promise<FastifyReply> => {
      await authService.resetPassword(db, request.body);
      return reply.status(204).send();
    },

    me: (request: FastifyRequest, reply: FastifyReply): void => {
      const { id, nome, email, role } = request.user!;
      void reply.send({ id, nome, email, role });
    },
  };
}
