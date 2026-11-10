import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { APPLICATION_AREAS, APPLICATION_STATUSES } from '@fixable/shared';

export const applicationAreaEnum = pgEnum('application_area', APPLICATION_AREAS);
export const applicationStatusEnum = pgEnum('application_status', APPLICATION_STATUSES);

export const applications = pgTable('applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  email: text('email').notNull(),
  telefone: text('telefone').notNull(),
  cidade: text('cidade').notNull(),
  area: applicationAreaEnum('area').notNull(),
  status: applicationStatusEnum('status').notNull().default('pendente'),
  consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
