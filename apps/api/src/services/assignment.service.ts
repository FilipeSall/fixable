import { and, asc, count, eq, sql } from 'drizzle-orm';
import type { Tx } from '../types/db.types.ts';
import { clients, users } from '../models/index.ts';

const ENGINEER_ASSIGNMENT_LOCK = 7_301_001;

/** Escolhe o engenheiro ativo e não demo com menos clientes, serializando a escolha até o commit. */
export async function pickEngineer(tx: Tx): Promise<{ id: string; nome: string } | null> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${ENGINEER_ASSIGNMENT_LOCK}::bigint)`);
  const [engineer] = await tx
    .select({ id: users.id, nome: users.nome })
    .from(users)
    .leftJoin(clients, eq(clients.engineerId, users.id))
    .where(and(eq(users.role, 'engenheiro'), eq(users.status, 'ativo'), eq(users.isDemo, false)))
    .groupBy(users.id)
    .orderBy(asc(count(clients.id)), asc(users.createdAt), asc(users.id))
    .limit(1);
  return engineer ?? null;
}
