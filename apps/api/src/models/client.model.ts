import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './user.model.ts';

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    engineerId: uuid('engineer_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('clients_engineer_id_idx').on(table.engineerId)],
);
