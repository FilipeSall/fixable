import { z } from 'zod';
import { appointmentInput, serviceRequestInput, serviceUpdateInput } from './platform.ts';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_MESSAGE = 'Informe o mês.';

const clearableText = serviceUpdateInput.shape.descricao;
const optionalPropertyId = serviceRequestInput.shape.propertyId.unwrap();

export const serviceRequestUpdateInput = serviceRequestInput.partial().extend({
  propertyId: optionalPropertyId.nullable().optional(),
});

export const appointmentUpdateInput = appointmentInput.partial().extend({ descricao: clearableText });

export const appointmentsQuery = z.object({
  mes: z.string({ error: MONTH_MESSAGE }).regex(MONTH_PATTERN, MONTH_MESSAGE),
  propertyId: optionalPropertyId.optional(),
});
