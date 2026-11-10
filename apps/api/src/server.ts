import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createDb } from './db/client.ts';
import { createMemoryMailer } from './modules/mail/memory-mailer.ts';

const config = loadConfig();
const { db, close } = createDb(config.DATABASE_URL);
const mailer = createMemoryMailer();
const app = await buildApp({ config, db, mailer });

async function shutdown(): Promise<void> {
  await app.close();
  await close();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ host: '0.0.0.0', port: config.PORT });
