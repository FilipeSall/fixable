import { z } from 'zod';
import { emailSchema } from './auth.ts';
import { APPLICATION_AREAS, APPLICATION_STATUSES, PLANS, PROPERTY_TYPES, SERVICE_REQUEST_STATUSES } from './catalog.ts';
import type { AppointmentStatus, ServiceStatus } from './types/platform.types.ts';

export const MAQUETE_COLUMNS = 6;
export const MAX_ROOM_WIDTH = 4;
export const MAX_ROOM_HEIGHT = 2;

export const SERVICE_STATUSES = ['prioridade', 'atencao', 'execucao', 'concluido'] as const;
export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  prioridade: 'Prioridade',
  atencao: 'Precisa de atenção',
  execucao: 'Em execução',
  concluido: 'Concluído',
};

export const APPOINTMENT_STATUSES = ['confirmado', 'pendente', 'adiado'] as const;
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  confirmado: 'Confirmado',
  pendente: 'Pendente · requer confirmação',
  adiado: 'Adiado',
};

export const TEAM_INVITE_ROLES = ['engenheiro', 'admin'] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID_MESSAGE = 'Identificador inválido.';
const DATE_MESSAGE = 'Informe uma data válida.';
const TIME_MESSAGE = 'Informe o horário.';
const SERVICE_MESSAGE = 'Informe o serviço.';
const REQUEST_MESSAGE = 'Descreva o que foi solicitado.';
const ATTRIBUTE_MESSAGE = 'Preencha a informação e o valor.';
const NAME_MESSAGE = 'Informe o nome.';

const idSchema = z.uuid({ error: ID_MESSAGE });
const nameSchema = z.string({ error: NAME_MESSAGE }).trim().min(1, NAME_MESSAGE).max(80, NAME_MESSAGE);
const optionalText = z
  .string()
  .trim()
  .max(2000)
  .transform((valor) => valor || undefined)
  .optional();
const clearableText = z
  .string()
  .trim()
  .max(2000)
  .transform((valor) => valor || null)
  .nullable()
  .optional();

/** Confere se o texto é uma data real no formato YYYY-MM-DD. */
const isRealDate = (valor: string): boolean => {
  if (!DATE_PATTERN.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().startsWith(valor);
};

const dateSchema = z.string({ error: DATE_MESSAGE }).refine(isRealDate, DATE_MESSAGE);

export const idParams = z.object({ id: idSchema });

export const propertyAttributeParams = z.object({ id: idSchema, attrId: idSchema });

export const floorInput = z.object({ nome: nameSchema });

export const newFloorInput = floorInput.partial();

export const roomInput = z.object({
  floorId: idSchema,
  nome: nameSchema,
  largura: z.number().int().min(1).max(MAX_ROOM_WIDTH),
  altura: z.number().int().min(1).max(MAX_ROOM_HEIGHT),
  x: z
    .number()
    .int()
    .min(0)
    .max(MAQUETE_COLUMNS - 1)
    .optional(),
  y: z.number().int().min(0).optional(),
});

export const serviceInput = z.object({
  roomId: idSchema,
  titulo: z.string({ error: 'Informe o título do serviço.' }).trim().min(1, 'Informe o título do serviço.').max(120),
  descricao: optionalText,
  status: z.enum(SERVICE_STATUSES, { error: 'Selecione o status.' }),
  prazo: dateSchema.optional(),
  percentual: z.number().int().min(0).max(100),
});

export const roomFieldsInput = roomInput.omit({ floorId: true });

export const serviceUpdateInput = serviceInput.partial().extend({
  descricao: clearableText,
  prazo: dateSchema.nullable().optional(),
});

export const serviceRequestInput = z.object({
  descricao: z.string({ error: REQUEST_MESSAGE }).trim().min(3, REQUEST_MESSAGE).max(2000, REQUEST_MESSAGE),
  status: z.enum(SERVICE_REQUEST_STATUSES, { error: 'Selecione o status.' }),
  propertyId: idSchema.optional(),
});

export const appointmentInput = z.object({
  propertyId: idSchema,
  servico: z.string({ error: SERVICE_MESSAGE }).trim().min(3, SERVICE_MESSAGE).max(120, SERVICE_MESSAGE),
  data: dateSchema,
  hora: z.string({ error: TIME_MESSAGE }).regex(TIME_PATTERN, TIME_MESSAGE),
  status: z.enum(APPOINTMENT_STATUSES, { error: 'Selecione o status.' }),
  descricao: optionalText,
});

export const propertyAttributeInput = z.object({
  chave: z.string({ error: ATTRIBUTE_MESSAGE }).trim().min(1, ATTRIBUTE_MESSAGE).max(80, ATTRIBUTE_MESSAGE),
  valor: z.string({ error: ATTRIBUTE_MESSAGE }).trim().min(1, ATTRIBUTE_MESSAGE).max(500, ATTRIBUTE_MESSAGE),
});

export const propertyInput = z.object({
  apelido: nameSchema,
  tipo: z.enum(PROPERTY_TYPES, { error: 'Selecione o tipo de imóvel.' }),
  cidade: z.string({ error: 'Informe a cidade.' }).trim().min(1, 'Informe a cidade.').max(80),
});

export const teamInviteInput = z.object({
  nome: z.string({ error: NAME_MESSAGE }).trim().min(3, NAME_MESSAGE).max(120, NAME_MESSAGE),
  email: emailSchema,
  role: z.enum(TEAM_INVITE_ROLES, { error: 'Selecione o papel.' }),
});

const idString = z.string().min(1);
const timestamp = z.string();
const engineerRef = z.object({ nome: z.string() }).nullable();

export const clientStats = z.object({
  clientes: z.number().int(),
  solicitacoesAbertas: z.number().int(),
  servicosEmAndamento: z.number().int(),
  agendamentosAConfirmar: z.number().int(),
});

export const clientListItem = z.object({
  id: idString,
  nome: z.string(),
  tipoImovel: z.enum(PROPERTY_TYPES).nullable(),
  cidade: z.string().nullable(),
  novo: z.boolean(),
  servicosAtivos: z.number().int(),
  solicitacoesAbertas: z.number().int(),
});

export const clientListResponse = z.object({ stats: clientStats, clients: z.array(clientListItem) });

export const propertySummary = z.object({
  id: idString,
  apelido: z.string(),
  tipo: z.enum(PROPERTY_TYPES),
  cidade: z.string(),
});

export const clientDetail = z.object({
  id: idString,
  nome: z.string(),
  email: z.string(),
  telefone: z.string().nullable(),
  engenheiro: engineerRef,
  properties: z.array(propertySummary),
});

export const meClientResponse = z.object({ clientId: idString });

export const propertyAttribute = z.object({ id: idString, chave: z.string(), valor: z.string() });

export const room = z.object({
  id: idString,
  nome: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  largura: z.number().int(),
  altura: z.number().int(),
});

export const floor = z.object({
  id: idString,
  nome: z.string(),
  posicao: z.number().int(),
  rooms: z.array(room),
});

export const service = z.object({
  id: idString,
  roomId: idString.nullable(),
  titulo: z.string(),
  descricao: z.string().nullable(),
  status: z.enum(SERVICE_STATUSES),
  prazo: z.string().nullable(),
  percentual: z.number().int(),
  concludedAt: timestamp.nullable(),
});

export const floorplan = z.object({ floors: z.array(floor), services: z.array(service) });

export const historyItem = z.object({
  id: idString,
  titulo: z.string(),
  descricao: z.string().nullable(),
  andar: z.string().nullable(),
  comodo: z.string().nullable(),
  concludedAt: timestamp,
});

export const serviceRequest = z.object({
  id: idString,
  descricao: z.string(),
  status: z.enum(SERVICE_REQUEST_STATUSES),
  propertyId: idString.nullable(),
  propertyApelido: z.string().nullable(),
  createdAt: timestamp,
});

export const appointment = z.object({
  id: idString,
  propertyId: idString,
  propertyApelido: z.string().nullable(),
  servico: z.string(),
  data: z.string(),
  hora: z.string(),
  status: z.enum(APPOINTMENT_STATUSES),
  descricao: z.string().nullable(),
});

export const engineerAppointment = appointment.extend({ clientId: idString, clientNome: z.string() });

export const adminLead = z.object({
  id: idString,
  nome: z.string(),
  email: z.string(),
  telefone: z.string(),
  cidade: z.string(),
  tipoImovel: z.enum(PROPERTY_TYPES),
  plano: z.enum(PLANS.map((plano) => plano.id)).nullable(),
  engenheiro: engineerRef,
  createdAt: timestamp,
});

export const adminApplication = z.object({
  id: idString,
  nome: z.string(),
  email: z.string(),
  telefone: z.string(),
  cidade: z.string(),
  area: z.enum(APPLICATION_AREAS),
  status: z.enum(APPLICATION_STATUSES),
  createdAt: timestamp,
});
