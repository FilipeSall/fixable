import { z } from 'zod';
import { ROLES } from './roles.ts';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_PASSWORD_MESSAGE = 'A senha pode ter no máximo 128 caracteres.';

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Informe um e-mail válido.'));

export const passwordSchema = z.string().superRefine((senha, ctx) => {
  if (senha.length < MIN_PASSWORD_LENGTH) {
    ctx.addIssue({ code: 'custom', message: 'A senha precisa ter pelo menos 8 caracteres.' });
    return;
  }
  if (senha.length > MAX_PASSWORD_LENGTH) {
    ctx.addIssue({ code: 'custom', message: MAX_PASSWORD_MESSAGE });
    return;
  }
  if (!/[A-Za-zÀ-ÿ]/.test(senha) || !/\d/.test(senha)) {
    ctx.addIssue({ code: 'custom', message: 'Use letras e números na senha.' });
  }
});

export const loginInput = z.object({
  email: emailSchema,
  senha: z.string().min(1, 'Informe sua senha.').max(MAX_PASSWORD_LENGTH, MAX_PASSWORD_MESSAGE),
});

export const setPasswordInput = z.object({
  token: z.string().min(1),
  senha: passwordSchema,
});

export const tokenLookupInput = z.object({
  token: z.string().min(1),
});

export const forgotPasswordInput = z.object({
  email: emailSchema,
});

export const meResponse = z.object({
  id: z.uuid(),
  nome: z.string(),
  email: z.string(),
  role: z.enum(ROLES),
});

export const tokenInfoResponse = z.object({
  purpose: z.enum(['convite', 'redefinicao']),
  nome: z.string(),
  email: z.string(),
});
