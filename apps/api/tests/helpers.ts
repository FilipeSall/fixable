import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Role, UserStatus } from '@fixable/shared';
import { buildApp } from '../src/app.ts';
import { loadConfig, type Config } from '../src/config/env.ts';
import { createDb, type Db } from '../src/db/client.ts';
import { users } from '../src/models/index.ts';
import { hashPassword } from '../src/utils/password.ts';
import { createMemoryMailer, type MemoryMailer } from '../src/mailers/memory.mailer.ts';

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
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '%drizzle%'`,
  );
  if (rows.length === 0) return;
  const names = rows.map((row) => `"public"."${row.tablename}"`).join(', ');
  await db.execute(sql.raw(`TRUNCATE ${names} RESTART IDENTITY CASCADE`));
}

export async function createUser(
  db: Db,
  p: { role: Role; status?: UserStatus; email?: string; nome?: string; passwordHash?: string; senha?: string },
): Promise<{ id: string; email: string }> {
  const suffix = randomUUID().slice(0, 8);
  const passwordHash = p.senha === undefined ? (p.passwordHash ?? null) : await hashPassword(p.senha);
  const [row] = await db
    .insert(users)
    .values({
      role: p.role,
      status: p.status ?? 'ativo',
      nome: p.nome ?? `Usuário ${suffix}`,
      email: p.email ?? `usuario-${suffix}@fixable.test`,
      passwordHash,
    })
    .returning({ id: users.id, email: users.email });
  return row!;
}

export async function loginAs(app: FastifyInstance, email: string, senha: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { origin: 'http://localhost:4321' },
    payload: { email, senha },
  });
  if (response.statusCode !== 200) {
    throw new Error(`loginAs falhou com ${response.statusCode}: ${response.body}`);
  }
  const cookie = response.cookies.find((item) => item.name === 'fx_session');
  if (!cookie) throw new Error('loginAs: cookie fx_session ausente');
  return `fx_session=${cookie.value}`;
}
