import { z } from 'zod';
import { APPLICATION_STATUSES } from './catalog.ts';

export const LEAD_ASSIGNMENT_FILTERS = ['todos', 'sem'] as const;
export const INVITE_DELIVERIES = ['enviado', 'reenviado'] as const;

export const adminLeadsQuery = z.object({ atribuicao: z.enum(LEAD_ASSIGNMENT_FILTERS).default('todos') });

export const adminApplicationsQuery = z.object({ status: z.enum(APPLICATION_STATUSES).optional() });

export const teamInviteResult = z.object({ userId: z.string().min(1), convite: z.enum(INVITE_DELIVERIES) });
