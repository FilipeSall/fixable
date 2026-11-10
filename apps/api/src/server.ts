import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createDb } from './db/client.ts';
import { createMemoryMailer } from './modules/mail/memory-mailer.ts';
import { startOutboxWorker } from './modules/mail/outbox.ts';
import { createSmtpMailer } from './modules/mail/smtp-mailer.ts';

const config = loadConfig();
const { db, close } = createDb(config.DATABASE_URL);
const mailer =
  config.MAIL_DRIVER === 'smtp' ? createSmtpMailer(config.SMTP_URL!, config.MAIL_FROM) : createMemoryMailer();
const app = await buildApp({ config, db, mailer });
const stopWorker = startOutboxWorker(db, mailer);

async function shutdown(): Promise<void> {
  await stopWorker();
  await app.close();
  await close();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ host: '0.0.0.0', port: config.PORT });
