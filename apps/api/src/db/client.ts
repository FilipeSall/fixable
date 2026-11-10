import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

/** Abre a conexão com o Postgres e devolve o cliente Drizzle e a função de fechamento. */
export function createDb(url: string) {
  const client = postgres(url, { max: 10 });
  const db = drizzle(client);
  return {
    db,
    close: () => client.end(),
  };
}
