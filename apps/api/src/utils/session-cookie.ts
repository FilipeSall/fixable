import type { FastifyReply } from 'fastify';

export const SESSION_COOKIE = 'fx_session';

/** Grava o cookie de sessão com os atributos de segurança e a data de expiração. */
export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date, secure: boolean): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    expires: expiresAt,
  });
}

/** Remove o cookie de sessão do navegador. */
export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}
