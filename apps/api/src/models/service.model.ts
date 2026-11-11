import { sql } from 'drizzle-orm';
import { check, date, index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { SERVICE_STATUSES } from '@fixable/shared';
import { rooms } from './floorplan.model.ts';
import { properties } from './property.model.ts';

export const serviceStatusEnum = pgEnum('service_status', SERVICE_STATUSES);

export const services = pgTable(
  'services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    titulo: text('titulo').notNull(),
    descricao: text('descricao'),
    status: serviceStatusEnum('status').notNull(),
    prazo: date('prazo'),
    percentual: integer('percentual').notNull().default(0),
    concludedAt: timestamp('concluded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('services_property_id_idx').on(table.propertyId),
    index('services_room_id_idx').on(table.roomId),
    check('services_percentual_range', sql`${table.percentual} BETWEEN 0 AND 100`),
  ],
);
