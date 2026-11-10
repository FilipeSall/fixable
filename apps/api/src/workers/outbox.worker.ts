import type { Db } from '../db/client.ts';
import { processOutbox } from '../services/outbox.service.ts';
import type { Mailer } from '../types/mail.types.ts';
import { serializeError } from '../utils/log-redaction.ts';

export function startOutboxWorker(db: Db, mailer: Mailer, intervalMs = 5000): () => Promise<void> {
  let inFlight: Promise<void> | null = null;
  const timer = setInterval(() => {
    if (inFlight) return;
    inFlight = processOutbox(db, mailer)
      .then(() => undefined)
      .catch((error: unknown) => {
        console.error('Falha ao processar a fila de e-mail', error instanceof Error ? serializeError(error) : error);
      })
      .finally(() => {
        inFlight = null;
      });
  }, intervalMs);
  return async () => {
    clearInterval(timer);
    await inFlight;
  };
}
