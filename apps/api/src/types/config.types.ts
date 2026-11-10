import type { z } from 'zod';
import type { configSchema } from '../config/env.ts';

export type Config = z.infer<typeof configSchema>;
