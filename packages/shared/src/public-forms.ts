import { z } from 'zod';
import { emailSchema } from './auth.ts';
import { APPLICATION_AREAS, CONTACT_PREFERENCES, PLANS, PROPERTY_TYPES } from './catalog.ts';

const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 13;
const TERMS_MESSAGE = 'Aceite os termos de uso e a política de privacidade para continuar.';

export const phoneSchema = z
  .string()
  .transform((valor) => valor.replaceAll(/\D/g, ''))
  .pipe(z.string().min(MIN_PHONE_DIGITS, 'Informe um telefone válido.').max(MAX_PHONE_DIGITS, 'Informe um telefone válido.'));

const nomeSchema = z.string().trim().min(3, 'Informe seu nome completo.').max(120, 'Informe seu nome completo.');
const cidadeSchema = z.string().trim().min(1, 'Informe sua cidade.').max(80, 'Informe sua cidade.');
const termosSchema = z.literal(true, { error: TERMS_MESSAGE });
const honeypotSchema = z.string().max(200).optional();

export const diagnosticInput = z.object({
  nome: nomeSchema,
  email: emailSchema,
  telefone: phoneSchema,
  cidade: cidadeSchema,
  tipoImovel: z.enum(PROPERTY_TYPES, { error: 'Selecione o tipo de imóvel.' }),
  descricao: z
    .string()
    .trim()
    .max(2000)
    .transform((valor) => valor || undefined)
    .optional(),
  preferenciaContato: z.enum(CONTACT_PREFERENCES, { error: 'Selecione a preferência de contato.' }),
  plano: z.enum(PLANS.map((plano) => plano.id)).optional(),
  aceiteTermos: termosSchema,
  website: honeypotSchema,
});
export type DiagnosticInput = z.infer<typeof diagnosticInput>;

export const applicationInput = z.object({
  nome: nomeSchema,
  email: emailSchema,
  telefone: phoneSchema,
  cidade: cidadeSchema,
  area: z.enum(APPLICATION_AREAS, { error: 'Selecione sua área de atuação.' }),
  aceiteTermos: termosSchema,
  website: honeypotSchema,
});
export type ApplicationInput = z.infer<typeof applicationInput>;
