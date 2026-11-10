import { parseArgs } from 'node:util';
import { emailSchema } from '@fixable/shared';
import { loadConfig } from '../config/env.ts';
import { createDb } from '../db/client.ts';
import { createAdmin } from '../services/admin.service.ts';

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
