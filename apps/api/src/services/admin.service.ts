import { eq } from 'drizzle-orm';
import type { Config } from '../types/config.types.ts';
import type { Db } from '../types/db.types.ts';
import { users } from '../models/index.ts';
import type { InviteDelivery } from '../types/admin.types.ts';
import { sendInvite } from './invite.service.ts';

const DUPLICATE_MESSAGE = 'Já existe um usuário com este e-mail.';

/** Cria o admin convidado e envia o convite, ou reenvia se ele ainda não aceitou, tudo numa transação. */
export async function createAdmin(
  db: Db,
  config: Pick<Config, 'APP_ORIGIN'>,
  input: { nome: string; email: string },
): Promise<{ userId: string; invite: InviteDelivery }> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({ role: 'admin', status: 'convidado', nome: input.nome, email: input.email })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    if (created) {
      await sendInvite(tx, config, created.id);
      return { userId: created.id, invite: 'enviado' };
    }
    const [existing] = await tx.select().from(users).where(eq(users.email, input.email)).for('update');
    if (existing?.role !== 'admin' || existing.status !== 'convidado') throw new Error(DUPLICATE_MESSAGE);
    await sendInvite(tx, config, existing.id);
    return { userId: existing.id, invite: 'reenviado' };
  });
}
