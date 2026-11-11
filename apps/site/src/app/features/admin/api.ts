import { API, type AdminApplication, type AdminLead, type ApplicationStatus, type TeamInviteInput } from '@fixable/shared';
import { apiFetch } from '../../api.ts';
import type { LeadFilter } from '../../../types/admin-ui.types.ts';

export const adminKeys = {
  leads: (filter: LeadFilter) => ['admin', 'leads', filter] as const,
  applications: (status: ApplicationStatus) => ['admin', 'applications', status] as const,
  all: ['admin'] as const,
};

/** Lista os leads de diagnóstico, todos ou só os sem engenheiro. */
export function fetchLeads(filter: LeadFilter): Promise<AdminLead[]> {
  return apiFetch<AdminLead[]>(`${API.adminLeads}?atribuicao=${filter}`);
}

/** Lista as candidaturas de um status. */
export function fetchApplications(status: ApplicationStatus): Promise<AdminApplication[]> {
  return apiFetch<AdminApplication[]>(`${API.adminApplications}?status=${status}`);
}

/** Aprova a candidatura: cria a conta e envia o convite. */
export function approveApplication(id: string): Promise<unknown> {
  return apiFetch<unknown>(API.adminApplicationApprove(id), { method: 'POST' });
}

/** Recusa a candidatura, sem criar conta. */
export function refuseApplication(id: string): Promise<unknown> {
  return apiFetch<unknown>(API.adminApplicationRefuse(id), { method: 'POST' });
}

/** Convida um engenheiro ou administrador por e-mail. */
export function inviteTeamMember(input: TeamInviteInput): Promise<unknown> {
  return apiFetch<unknown>(API.adminInvites, { method: 'POST', body: input });
}
