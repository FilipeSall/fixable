import type { z } from 'zod';
import type { appointmentsQuery, appointmentUpdateInput, serviceRequestUpdateInput } from '../agenda.ts';

export type ServiceRequestUpdateInput = z.infer<typeof serviceRequestUpdateInput>;
export type AppointmentUpdateInput = z.infer<typeof appointmentUpdateInput>;
export type AppointmentsQuery = z.infer<typeof appointmentsQuery>;
