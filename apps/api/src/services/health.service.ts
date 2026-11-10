import { sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';

export async function isDatabaseUp(db: Db): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
