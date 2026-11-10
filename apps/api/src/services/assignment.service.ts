import { and, asc, count, eq } from 'drizzle-orm';
import type { Db, Tx } from '../types/db.types.ts';
import { clients, users } from '../models/index.ts';

/** Escolhe o engenheiro ativo com menos clientes para receber um novo atendimento. */
export async function pickEngineer(db: Db | Tx): Promise<{ id: string; nome: string } | null> {
  const [engineer] = await db
    .select({ id: users.id, nome: users.nome })
    .from(users)
    .leftJoin(clients, eq(clients.engineerId, users.id))
    .where(and(eq(users.role, 'engenheiro'), eq(users.status, 'ativo')))
    .groupBy(users.id)
    .orderBy(asc(count(clients.id)), asc(users.createdAt), asc(users.id))
    .limit(1);
  return engineer ?? null;
}
