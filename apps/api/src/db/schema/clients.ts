import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { PROPERTY_TYPES, SERVICE_REQUEST_STATUSES } from '@fixable/shared';
import { users } from './identity.ts';

export const propertyTypeEnum = pgEnum('property_type', PROPERTY_TYPES);
export const serviceRequestStatusEnum = pgEnum('service_request_status', SERVICE_REQUEST_STATUSES);

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

export const floors = pgTable('floors', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id')
    .notNull()
    .references(() => properties.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  posicao: integer('posicao').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  floorId: uuid('floor_id')
    .notNull()
    .references(() => floors.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  largura: integer('largura').notNull(),
  altura: integer('altura').notNull(),
  posicao: integer('posicao').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

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
