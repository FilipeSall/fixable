import type { z } from 'zod';
import type { demoAccount } from '../demo.ts';

export type DemoAccount = z.infer<typeof demoAccount>;
