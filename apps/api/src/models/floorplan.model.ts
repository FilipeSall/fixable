import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { properties } from './property.model.ts';

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
