import type { createDb } from '../db/client.ts';

export type Db = ReturnType<typeof createDb>['db'];
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
