import { z } from 'zod';
import { emailSchema } from './auth.ts';
import { ROLES } from './roles.ts';

export const DEMO_SENHA = 'fixable123';

export const DEMO_EMAIL_SUFFIX = '.demo@fixable.com.br';

export const RESERVED_EMAIL_MESSAGE = 'Este domínio de e-mail é reservado.';

/** Diz se o e-mail é do domínio reservado da demonstração (`*.demo@fixable.com.br`), ignorando caixa e espaços. */
export function isDemoEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(DEMO_EMAIL_SUFFIX);
}

export const nonDemoEmailSchema = emailSchema.refine((email) => !isDemoEmail(email), RESERVED_EMAIL_MESSAGE);

export const demoAccount = z.object({
  nome: z.string(),
  email: z.string(),
  role: z.enum(ROLES),
  descricao: z.string(),
});

export const demoAccountsResponse = z.array(demoAccount);
