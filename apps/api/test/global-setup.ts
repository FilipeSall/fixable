import { runMigrations } from '../src/db/migrate.ts';

const DEFAULT_DATABASE_URL_TEST = 'postgres://fixable:fixable@localhost:5432/fixable_test';

export default async function setup(): Promise<void> {
  await runMigrations(process.env['DATABASE_URL_TEST'] ?? DEFAULT_DATABASE_URL_TEST);
}
