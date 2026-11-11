import type { z } from 'zod';
import type {
  adminApplicationsQuery,
  adminLeadsQuery,
  INVITE_DELIVERIES,
  LEAD_ASSIGNMENT_FILTERS,
  teamInviteResult,
} from '../admin.ts';

export type LeadAssignmentFilter = (typeof LEAD_ASSIGNMENT_FILTERS)[number];
export type InviteDelivery = (typeof INVITE_DELIVERIES)[number];
export type AdminLeadsQuery = z.infer<typeof adminLeadsQuery>;
export type AdminApplicationsQuery = z.infer<typeof adminApplicationsQuery>;
export type TeamInviteResult = z.infer<typeof teamInviteResult>;
