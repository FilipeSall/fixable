import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { PROPERTY_TYPES } from '@fixable/shared';
import { clients } from './client.model.ts';

export const propertyTypeEnum = pgEnum('property_type', PROPERTY_TYPES);

export const properties = pgTable(
  'properties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    tipo: propertyTypeEnum('tipo').notNull(),
    cidade: text('cidade').notNull(),
    apelido: text('apelido').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('properties_client_id_idx').on(table.clientId)],
);

export const propertyAttributes = pgTable('property_attributes', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id')
    .notNull()
    .references(() => properties.id, { onDelete: 'cascade' }),
  chave: text('chave').notNull(),
  valor: text('valor').notNull(),
  posicao: integer('posicao').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
