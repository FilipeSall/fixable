import { date, index, pgEnum, pgTable, text, time, timestamp, uuid } from 'drizzle-orm/pg-core';
import { APPOINTMENT_STATUSES } from '@fixable/shared';
import { clients } from './client.model.ts';
import { properties } from './property.model.ts';

export const appointmentStatusEnum = pgEnum('appointment_status', APPOINTMENT_STATUSES);

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    servico: text('servico').notNull(),
    data: date('data').notNull(),
    hora: time('hora').notNull(),
    status: appointmentStatusEnum('status').notNull().default('pendente'),
    descricao: text('descricao'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('appointments_client_id_data_idx').on(table.clientId, table.data)],
);
