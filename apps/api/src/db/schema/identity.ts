import { sql } from 'drizzle-orm';
import { check, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { ROLES, USER_STATUSES } from '@fixable/shared';

export const roleEnum = pgEnum('role', ROLES);
export const userStatusEnum = pgEnum('user_status', USER_STATUSES);
export const emailTokenPurposeEnum = pgEnum('email_token_purpose', ['convite', 'redefinicao']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    role: roleEnum('role').notNull(),
    status: userStatusEnum('status').notNull().default('convidado'),
    nome: text('nome').notNull(),
    email: text('email').notNull().unique(),
    telefone: text('telefone'),
    cidade: text('cidade'),
    passwordHash: text('password_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [check('users_email_normalized', sql`${table.email} = lower(btrim(${table.email}))`)],
);

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const emailTokens = pgTable('email_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  purpose: emailTokenPurposeEnum('purpose').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
