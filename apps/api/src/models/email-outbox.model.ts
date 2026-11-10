import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { emailTokens } from './email-token.model.ts';

export const outboxStatusEnum = pgEnum('outbox_status', ['pendente', 'enviado', 'falhou', 'descartado']);

export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    to: text('to').notNull(),
    template: text('template').notNull(),
    data: jsonb('data').notNull(),
    emailTokenId: uuid('email_token_id').references(() => emailTokens.id, { onDelete: 'cascade' }),
    status: outboxStatusEnum('status').notNull().default('pendente'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (table) => [index('email_outbox_status_next_attempt_idx').on(table.status, table.nextAttemptAt)],
);
