import { parseArgs } from 'node:util';
import { DEMO_SENHA } from '@fixable/shared';
import { loadConfig } from '../config/env.ts';
import { DEMO_ACCOUNTS } from '../db/demo-data.ts';
import { createDb } from '../db/client.ts';
import { removeDemo, seedDemo } from '../services/demo-seed.service.ts';
import type { Db } from '../types/db.types.ts';
import type { DemoConfig } from '../types/demo.types.ts';

/** Diz se o comando foi chamado com --remove, para apagar a demonstração em vez de criá-la. */
function wantsRemoval(argv: string[]): boolean {
  const { values } = parseArgs({ args: argv, options: { remove: { type: 'boolean', default: false } } });
  return values.remove;
}

/** Cria ou restaura a demonstração e lista as contas com a senha de acesso. */
async function seed(db: Db, config: DemoConfig): Promise<void> {
  const resumo = await seedDemo(db, config);
  console.log(
    `Demonstração pronta: ${resumo.clientes} clientes, ${resumo.servicos} serviços, ` +
      `${resumo.solicitacoes} solicitações e ${resumo.agendamentos} agendamentos.`,
  );
  for (const account of DEMO_ACCOUNTS) console.log(`  ${account.role.padEnd(10)} ${account.email}`);
  console.log(`Senha de todas as contas: ${DEMO_SENHA}`);
}

/** Executa o seed (ou a remoção, com --remove) e encerra com código de erro se algo falhar. */
async function main(): Promise<void> {
  let close: (() => Promise<void>) | undefined;
  try {
    const remove = wantsRemoval(process.argv.slice(2));
    const config = loadConfig();
    const connection = createDb(config.DATABASE_URL);
    close = connection.close;
    if (remove) {
      const { usuarios } = await removeDemo(connection.db);
      console.log(`Demonstração removida: ${usuarios} contas apagadas com os dados delas.`);
    } else {
      await seed(connection.db, config);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await close?.();
  }
}

if (import.meta.main) await main();
