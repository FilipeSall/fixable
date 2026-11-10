import { hash, verify } from '@node-rs/argon2';

/** Gera o hash argon2id da senha para guardar no banco. */
export async function hashPassword(senha: string): Promise<string> {
  return hash(senha, { algorithm: 2 });
}

/** Confere a senha contra o hash e devolve false se o hash for inválido. */
export async function verifyPassword(passwordHash: string, senha: string): Promise<boolean> {
  try {
    return await verify(passwordHash, senha);
  } catch {
    return false;
  }
}
