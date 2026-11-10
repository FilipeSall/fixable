import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { buildApp } from '../src/app.ts';
import { loadConfig, type Config } from '../src/config.ts';
import { createDb, type Db } from '../src/db/client.ts';
import { createMemoryMailer, type MemoryMailer } from '../src/modules/mail/memory-mailer.ts';

const DEFAULT_DATABASE_URL_TEST = 'postgres://fixable:fixable@localhost:5432/fixable_test';

export type TestApp = {
  app: FastifyInstance;
  db: Db;
  mailer: MemoryMailer;
  config: Config;
  close(): Promise<void>;
};

export async function testApp(overrides: Partial<Config> = {}): Promise<TestApp> {
  const databaseUrl = process.env['DATABASE_URL_TEST'] ?? DEFAULT_DATABASE_URL_TEST;
  const config: Config = {
    ...loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      APP_ORIGIN: 'http://localhost:4321',
      COOKIE_SECURE: 'false',
      MAIL_DRIVER: 'memory',
      MAIL_FROM: 'Fixable <nao-responda@fixable.local>',
    }),
    ...overrides,
  };
  const { db, close: closeDb } = createDb(config.DATABASE_URL);
  const mailer = createMemoryMailer();
  const app = await buildApp({ config, db, mailer });
  return {
    app,
    db,
    mailer,
    config,
    async close() {
      await app.close();
      await closeDb();
    },
  };
}

export async function resetDb(db: Db): Promise<void> {
  const rows = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '%drizzle%' AND tablename NOT LIKE '\_\_%'`,
  );
  if (rows.length === 0) return;
  const names = rows.map((row) => `"public"."${row.tablename}"`).join(', ');
  await db.execute(sql.raw(`TRUNCATE ${names} RESTART IDENTITY CASCADE`));
}
