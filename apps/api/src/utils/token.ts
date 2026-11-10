import { createHash } from 'node:crypto';

/** Calcula o hash SHA-256 de um token, que é o que vai para o banco no lugar do token em claro. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
