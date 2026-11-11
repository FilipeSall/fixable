import { z } from 'zod';
import { ROLES } from './roles.ts';

export const DEMO_SENHA = 'fixable123';

export const demoAccount = z.object({
  nome: z.string(),
  email: z.string(),
  role: z.enum(ROLES),
  descricao: z.string(),
});

export const demoAccountsResponse = z.array(demoAccount);
