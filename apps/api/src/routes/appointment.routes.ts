import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  appointment,
  appointmentInput,
  appointmentsQuery,
  appointmentUpdateInput,
  engineerAppointment,
  idParams,
} from '@fixable/shared';
import { createAppointmentController } from '../controllers/appointment.controller.ts';
import type { AppointmentDeps } from '../types/appointment.types.ts';

/** Declara as rotas dos agendamentos do cliente e do calendário da equipe. */
export function appointmentRoutes(deps: AppointmentDeps) {
  return (instance: FastifyInstance, _options: object, done: () => void): void => {
    const app = instance.withTypeProvider<ZodTypeProvider>();
    const controller = createAppointmentController(deps);
    const auth = { preHandler: [instance.requireAuth] };

    app.get(
      '/appointments',
      {
        preHandler: [instance.requireRole('engenheiro', 'admin')],
        schema: { querystring: appointmentsQuery, response: { 200: z.array(engineerAppointment) } },
      },
      controller.calendar,
    );

    app.get(
      '/clients/:id/appointments',
      {
        ...auth,
        schema: { params: idParams, querystring: appointmentsQuery, response: { 200: z.array(appointment) } },
      },
      controller.list,
    );

    app.post(
      '/clients/:id/appointments',
      { ...auth, schema: { params: idParams, body: appointmentInput, response: { 201: appointment } } },
      controller.create,
    );

    app.patch(
      '/appointments/:id',
      { ...auth, schema: { params: idParams, body: appointmentUpdateInput, response: { 200: appointment } } },
      controller.update,
    );

    app.delete('/appointments/:id', { ...auth, schema: { params: idParams } }, controller.remove);
    done();
  };
}
