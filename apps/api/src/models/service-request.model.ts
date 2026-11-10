import { index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { SERVICE_REQUEST_STATUSES } from '@fixable/shared';
import { clients } from './client.model.ts';
import { properties } from './property.model.ts';

export const serviceRequestStatusEnum = pgEnum('service_request_status', SERVICE_REQUEST_STATUSES);

export const serviceRequests = pgTable(
  'service_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'set null' }),
    descricao: text('descricao').notNull(),
    status: serviceRequestStatusEnum('status').notNull().default('em_analise'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('service_requests_client_id_idx').on(table.clientId)],
);
