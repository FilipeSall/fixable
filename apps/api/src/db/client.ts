import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export function createDb(url: string) {
  const client = postgres(url, { max: 10 });
  const db = drizzle(client);
  return {
    db,
    close: () => client.end(),
  };
}

export type Db = ReturnType<typeof createDb>['db'];
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
