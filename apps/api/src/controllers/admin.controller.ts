import type { FastifyReply } from 'fastify';
import type { AdminApplication, AdminLead, TeamInviteResult } from '@fixable/shared';
import * as adminService from '../services/admin.service.ts';
import * as teamService from '../services/team.service.ts';
import type {
  AdminApplicationRequest,
  AdminApplicationsRequest,
  AdminLeadsRequest,
  TeamInviteRequest,
} from '../types/admin.types.ts';
import type { PlatformMailDeps } from '../types/platform.types.ts';

/** Cria o controller do painel admin: leads, candidaturas e convites da equipe. */
export function createAdminController(deps: PlatformMailDeps) {
  return {
    leads: (request: AdminLeadsRequest): Promise<AdminLead[]> => {
      return adminService.listLeads(deps.db, request.user!, request.query);
    },

    applications: (request: AdminApplicationsRequest): Promise<AdminApplication[]> => {
      return adminService.listApplications(deps.db, request.user!, request.query);
    },

    approve: (request: AdminApplicationRequest): Promise<AdminApplication> => {
      return teamService.approveApplication(deps, request.user!, request.params.id);
    },

    refuse: (request: AdminApplicationRequest): Promise<AdminApplication> => {
      return teamService.refuseApplication(deps, request.user!, request.params.id);
    },

    invite: async (request: TeamInviteRequest, reply: FastifyReply): Promise<TeamInviteResult> => {
      const result = await teamService.inviteTeamMember(deps, request.user!, request.body);
      reply.status(201);
      return result;
    },
  };
}
