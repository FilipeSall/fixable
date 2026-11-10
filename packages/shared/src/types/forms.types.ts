import type { z } from 'zod';
import type { applicationInput, diagnosticInput } from '../public-forms.ts';

export type DiagnosticInput = z.infer<typeof diagnosticInput>;
export type ApplicationInput = z.infer<typeof applicationInput>;
