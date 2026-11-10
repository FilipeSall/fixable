import { z } from 'zod';
import type { Config } from '../types/config.types.ts';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

export const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3333),
    DATABASE_URL: z.string().min(1),
    APP_ORIGIN: z.url(),
    COOKIE_SECURE: booleanString.default(true),
    TRUST_PROXY: booleanString.default(false),
    MAIL_DRIVER: z.enum(['smtp', 'memory']).default('smtp'),
    SMTP_URL: z.string().min(1).optional(),
    MAIL_FROM: z.string().min(1),
  })
  .refine((config) => config.MAIL_DRIVER !== 'smtp' || config.SMTP_URL !== undefined, {
    path: ['SMTP_URL'],
    message: 'SMTP_URL é obrigatório quando MAIL_DRIVER=smtp',
  })
  .refine((config) => config.NODE_ENV !== 'production' || config.MAIL_DRIVER === 'smtp', {
    path: ['MAIL_DRIVER'],
    message: 'MAIL_DRIVER precisa ser smtp quando NODE_ENV=production',
  });

/** Lê o ambiente e devolve a configuração validada, ou falha listando as variáveis inválidas. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Configuração inválida: ${details}`);
  }
  return parsed.data;
}
