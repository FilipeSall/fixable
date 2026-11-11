import { ilike, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { DEMO_EMAIL_SUFFIX } from '../db/demo-data.ts';

/** Diz se o e-mail é do domínio reservado da demonstração (`*.demo@fixable.com.br`). */
export function isDemoEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(DEMO_EMAIL_SUFFIX);
}

/** Monta o filtro SQL dos registros cujo e-mail é do domínio reservado da demonstração. */
export function demoEmailFilter(column: PgColumn): SQL {
  return ilike(column, `%${DEMO_EMAIL_SUFFIX}`);
}
