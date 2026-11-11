import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  adminApplication,
  adminApplicationsQuery,
  adminLead,
  adminLeadsQuery,
  idParams,
  teamInviteInput,
  teamInviteResult,
} from '@fixable/shared';
import { createAdminController } from '../controllers/admin.controller.ts';
import type { AdminDeps } from '../types/admin.types.ts';

/** Declara as rotas do painel admin, todas restritas ao papel admin. */
export function adminRoutes(deps: AdminDeps) {
  return (instance: FastifyInstance, _options: object, done: () => void): void => {
    const app = instance.withTypeProvider<ZodTypeProvider>();
    const controller = createAdminController(deps);
    const admin = { preHandler: [instance.requireRole('admin')] };

    app.get(
      '/admin/leads',
      { ...admin, schema: { querystring: adminLeadsQuery, response: { 200: z.array(adminLead) } } },
      controller.leads,
    );

    app.get(
      '/admin/applications',
      { ...admin, schema: { querystring: adminApplicationsQuery, response: { 200: z.array(adminApplication) } } },
      controller.applications,
    );

    app.post(
      '/admin/applications/:id/approve',
      { ...admin, schema: { params: idParams, response: { 200: adminApplication } } },
      controller.approve,
    );

    app.post(
      '/admin/applications/:id/refuse',
      { ...admin, schema: { params: idParams, response: { 200: adminApplication } } },
      controller.refuse,
    );

    app.post(
      '/admin/invites',
      { ...admin, schema: { body: teamInviteInput, response: { 201: teamInviteResult } } },
      controller.invite,
    );
    done();
  };
}
