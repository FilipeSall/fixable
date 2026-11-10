import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { emailSchema } from '@fixable/shared';
import { loadConfig, type Config } from '../config.ts';
import { createDb, type Db } from '../db/client.ts';
import { users } from '../db/schema/index.ts';
import { sendInvite } from '../modules/auth/invites.ts';

const DUPLICATE_MESSAGE = 'Já existe um usuário com este e-mail.';

export type InviteDelivery = 'enviado' | 'reenviado';

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

function parseInput(argv: string[]): { nome: string; email: string } {
  const { values } = parseArgs({
    args: argv,
    options: { nome: { type: 'string' }, email: { type: 'string' } },
  });
  const nome = values.nome?.trim() ?? '';
  if (!nome) throw new Error('Informe o nome com --nome.');
  const email = emailSchema.safeParse(values.email ?? '');
  if (!email.success) throw new Error(email.error.issues[0]?.message ?? 'Informe um e-mail válido.');
  return { nome, email: email.data };
}

async function main(): Promise<void> {
  let close: (() => Promise<void>) | undefined;
  try {
    const input = parseInput(process.argv.slice(2));
    const config = loadConfig();
    const connection = createDb(config.DATABASE_URL);
    close = connection.close;
    const { invite } = await createAdmin(connection.db, config, input);
    console.log(`Convite ${invite} para ${input.email}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await close?.();
  }
}

if (import.meta.main) await main();
