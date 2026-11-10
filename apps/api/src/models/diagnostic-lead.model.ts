import { index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { CONTACT_PREFERENCES, PLANS } from '@fixable/shared';
import { clients } from './client.model.ts';
import { propertyTypeEnum } from './property.model.ts';
import { users } from './user.model.ts';

const PLAN_IDS = PLANS.map((plano) => plano.id) as [(typeof PLANS)[number]['id'], ...(typeof PLANS)[number]['id'][]];

export const contactPreferenceEnum = pgEnum('contact_preference', CONTACT_PREFERENCES);
export const planIdEnum = pgEnum('plan_id', PLAN_IDS);

export const diagnosticLeads = pgTable(
  'diagnostic_leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: text('nome').notNull(),
    email: text('email').notNull(),
    telefone: text('telefone').notNull(),
    cidade: text('cidade').notNull(),
    tipoImovel: propertyTypeEnum('tipo_imovel').notNull(),
    descricao: text('descricao'),
    preferenciaContato: contactPreferenceEnum('preferencia_contato').notNull(),
    plano: planIdEnum('plano'),
    consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
    engineerId: uuid('engineer_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('diagnostic_leads_created_at_idx').on(table.createdAt)],
);
