import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { PropertyType, Role, UserStatus } from '@fixable/shared';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDb } from '../src/db/client.ts';
import { clients, properties, users } from '../src/models/index.ts';
import { hashPassword } from '../src/utils/password.ts';
import { createMemoryMailer } from '../src/mailers/memory.mailer.ts';
import type { Config } from '../src/types/config.types.ts';
import type { Db } from '../src/types/db.types.ts';
import type { MemoryMailer } from '../src/types/mail.types.ts';

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
      TEAM_EMAIL: 'equipe@fixable.local',
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

export async function createEngineer(
  db: Db,
  p: { nome?: string; email?: string; senha?: string; status?: UserStatus } = {},
): Promise<{ id: string; email: string }> {
  return createUser(db, { role: 'engenheiro', ...p });
}

export type ClientWithProperty = { userId: string; email: string; clientId: string; propertyId: string };

export async function createClientWithProperty(
  db: Db,
  p: {
    engineerId?: string | null;
    nome?: string;
    email?: string;
    senha?: string;
    tipo?: PropertyType;
    cidade?: string;
    apelido?: string;
  } = {},
): Promise<ClientWithProperty> {
  const user = await createUser(db, { role: 'cliente', nome: p.nome, email: p.email, senha: p.senha });
  const [client] = await db
    .insert(clients)
    .values({ userId: user.id, engineerId: p.engineerId ?? null })
    .returning({ id: clients.id });
  const [property] = await db
    .insert(properties)
    .values({
      clientId: client!.id,
      tipo: p.tipo ?? 'sobrado',
      cidade: p.cidade ?? 'Santo André',
      apelido: p.apelido ?? 'Casa principal',
    })
    .returning({ id: properties.id });
  return { userId: user.id, email: user.email, clientId: client!.id, propertyId: property!.id };
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

export function tokenFromLink(link: string): string {
  const url = new URL(link);
  if (url.search) throw new Error(`o link não deveria ter query string: ${link}`);
  const token = new URLSearchParams(url.hash.slice(1)).get('token');
  if (!token) throw new Error(`token ausente no fragmento do link: ${link}`);
  return token;
}
