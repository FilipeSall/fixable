import type { z } from 'zod';
import type { meResponse } from '../auth.ts';

export type Me = z.infer<typeof meResponse>;
