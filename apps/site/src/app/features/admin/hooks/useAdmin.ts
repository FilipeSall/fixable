import type { ApplicationStatus } from '@fixable/shared';
import { useQuery } from '@tanstack/react-query';
import type { LeadFilter } from '../../../../types/admin-ui.types.ts';
import { adminKeys, fetchApplications, fetchLeads } from '../api.ts';

/** Leads de diagnóstico pelo filtro escolhido. */
export function useLeads(filter: LeadFilter) {
  return useQuery({ queryKey: adminKeys.leads(filter), queryFn: () => fetchLeads(filter) });
}

/** Candidaturas pelo status escolhido. */
export function useApplications(status: ApplicationStatus) {
  return useQuery({ queryKey: adminKeys.applications(status), queryFn: () => fetchApplications(status) });
}
