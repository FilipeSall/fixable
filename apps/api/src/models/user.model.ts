import { sql } from 'drizzle-orm';
import { boolean, check, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { ROLES, USER_STATUSES } from '@fixable/shared';

export const roleEnum = pgEnum('role', ROLES);
export const userStatusEnum = pgEnum('user_status', USER_STATUSES);

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
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [check('users_email_normalized', sql`${table.email} = lower(btrim(${table.email}))`)],
);
