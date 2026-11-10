import type { ApplicationArea, ContactPreference, PlanId, PropertyType, ServiceRequestStatus } from './types/catalog.types.ts';

export const PLANS = [
  { id: '1m', nome: 'Plano para 1 mês' },
  { id: '3m', nome: 'Plano para 3 meses' },
  { id: '6m', nome: 'Plano para 6 meses' },
  { id: '12m', nome: 'Plano anual' },
] as const;

/** Devolve o nome do plano a partir do identificador, ou o próprio identificador se não existir. */
export const planName = (id: PlanId): string => PLANS.find((plano) => plano.id === id)?.nome ?? id;

export const PROPERTY_TYPES = ['casa_terrea', 'sobrado', 'apartamento', 'empresa'] as const;
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  casa_terrea: 'Casa térrea',
  sobrado: 'Sobrado',
  apartamento: 'Apartamento',
  empresa: 'Para empresas',
};

export const CONTACT_PREFERENCES = ['whatsapp', 'telefone', 'email'] as const;
export const CONTACT_PREFERENCE_LABELS: Record<ContactPreference, string> = {
  whatsapp: 'WhatsApp',
  telefone: 'Telefone',
  email: 'E-mail',
};

export const APPLICATION_AREAS = ['engenheiro', 'outro'] as const;
export const APPLICATION_AREA_LABELS: Record<ApplicationArea, string> = {
  engenheiro: 'Engenheiro',
  outro: 'Outro',
};

export const SERVICE_REQUEST_STATUSES = ['em_analise', 'agendado', 'em_execucao', 'concluido'] as const;
export const SERVICE_REQUEST_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  em_analise: 'Em análise',
  agendado: 'Agendado',
  em_execucao: 'Em execução',
  concluido: 'Concluído',
};

export const APPLICATION_STATUSES = ['pendente', 'aprovada', 'recusada'] as const;
