import { z } from 'zod';

export const ERROR_CODES = [
  'validation',
  'invalid_credentials',
  'account_blocked',
  'unauthorized',
  'forbidden',
  'token_invalid',
  'rate_limited',
  'not_found',
  'conflict',
  'internal',
] as const;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});
