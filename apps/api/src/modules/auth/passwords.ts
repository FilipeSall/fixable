import { hash, verify } from '@node-rs/argon2';

export async function hashPassword(senha: string): Promise<string> {
  return hash(senha, { algorithm: 2 });
}

export async function verifyPassword(passwordHash: string, senha: string): Promise<boolean> {
  try {
    return await verify(passwordHash, senha);
  } catch {
    return false;
  }
}
