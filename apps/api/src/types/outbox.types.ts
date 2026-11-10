import type { emailOutbox } from '../models/index.ts';

export type OutboxRow = typeof emailOutbox.$inferSelect;
export type DeliveryOutcome = 'enviado' | 'falhou' | 'descartado';
