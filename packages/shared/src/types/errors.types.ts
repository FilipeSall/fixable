import type { z } from 'zod';
import type { apiErrorSchema, ERROR_CODES } from '../errors.ts';

export type ErrorCode = (typeof ERROR_CODES)[number];
export type ApiError = z.infer<typeof apiErrorSchema>;
