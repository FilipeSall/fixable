import { and, eq } from 'drizzle-orm';
import type { DemoAccount } from '@fixable/shared';
import { DEMO_ACCOUNTS } from '../db/demo-data.ts';
import { users } from '../models/index.ts';
import type { DemoConfig } from '../types/demo.types.ts';
import type { Db } from '../types/db.types.ts';
import { notFound } from './access-policy.service.ts';

/** Lista as contas demo ativas na ordem da demonstração, ou responde 404 quando o modo demo está desligado. */
export async function listDemoAccounts(db: Db, config: DemoConfig): Promise<DemoAccount[]> {
  if (!config.DEMO_MODE) throw notFound();
  const rows = await db
    .select({ email: users.email, nome: users.nome, role: users.role })
    .from(users)
    .where(and(eq(users.isDemo, true), eq(users.status, 'ativo')));
  const byEmail = new Map(rows.map((row) => [row.email, row]));
  return DEMO_ACCOUNTS.flatMap((account) => {
    const row = byEmail.get(account.email);
    return row ? [{ nome: row.nome, email: row.email, role: row.role, descricao: account.descricao }] : [];
  });
}
