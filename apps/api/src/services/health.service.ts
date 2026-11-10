import { sql } from 'drizzle-orm';
import type { Db } from '../types/db.types.ts';

/** Informa se o banco responde a uma consulta simples. */
export async function isDatabaseUp(db: Db): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
