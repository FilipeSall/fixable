import { APPLICATION_AREA_LABELS, type ApplicationInput } from '@fixable/shared';
import { applications } from '../models/index.ts';
import type { Db } from '../types/db.types.ts';
import type { PublicConfig } from '../types/public.types.ts';
import { enqueueEmail } from './outbox.service.ts';

/** Registra a candidatura pendente do site e avisa a equipe, sem criar usuário. */
export async function submitApplication(
  db: Db,
  config: PublicConfig,
  input: ApplicationInput,
  now: Date = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(applications).values({
      nome: input.nome,
      email: input.email,
      telefone: input.telefone,
      cidade: input.cidade,
      area: input.area,
      status: 'pendente',
      consentAt: now,
    });
    await enqueueEmail(tx, {
      to: config.TEAM_EMAIL,
      template: 'nova-candidatura',
      data: {
        nome: input.nome,
        email: input.email,
        telefone: input.telefone,
        cidade: input.cidade,
        area: APPLICATION_AREA_LABELS[input.area],
      },
    });
  });
}
