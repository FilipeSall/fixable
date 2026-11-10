import { and, eq, lte, sql } from 'drizzle-orm';
import type { Db, Tx } from '../../db/client.ts';
import { emailOutbox } from '../../db/schema/index.ts';
import type { Mailer } from './mailer.ts';
import { renderTemplate, type TemplateData, type TemplateName } from './templates.ts';

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 5;
const MINUTE_MS = 60_000;
const withoutLink = sql`${emailOutbox.data} - 'link'`;

export async function enqueueEmail(
  db: Db | Tx,
  msg: { to: string; template: TemplateName; data: Record<string, string> },
): Promise<void> {
  await db.insert(emailOutbox).values({ to: msg.to, template: msg.template, data: msg.data });
}

export async function processOutbox(
  db: Db,
  mailer: Mailer,
  now: Date = new Date(),
): Promise<{ sent: number; failed: number }> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(emailOutbox)
      .where(and(eq(emailOutbox.status, 'pendente'), lte(emailOutbox.nextAttemptAt, now)))
      .orderBy(emailOutbox.nextAttemptAt)
      .limit(BATCH_SIZE)
      .for('update', { skipLocked: true });

    let sent = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        const content = renderTemplate(row.template as TemplateName, row.data as TemplateData);
        await mailer.send({ to: row.to, ...content });
        await tx
          .update(emailOutbox)
          .set({ status: 'enviado', sentAt: now, lastError: null, data: withoutLink })
          .where(eq(emailOutbox.id, row.id));
        sent += 1;
      } catch (error) {
        const attempts = row.attempts + 1;
        const exhausted = attempts >= MAX_ATTEMPTS;
        await tx
          .update(emailOutbox)
          .set({
            attempts,
            status: exhausted ? 'falhou' : 'pendente',
            ...(exhausted ? { data: withoutLink } : {}),
            nextAttemptAt: new Date(now.getTime() + 2 ** attempts * MINUTE_MS),
            lastError: error instanceof Error ? error.message : String(error),
          })
          .where(eq(emailOutbox.id, row.id));
        failed += 1;
      }
    }
    return { sent, failed };
  });
}

export function startOutboxWorker(db: Db, mailer: Mailer, intervalMs = 5000): () => Promise<void> {
  let inFlight: Promise<void> | null = null;
  const timer = setInterval(() => {
    if (inFlight) return;
    inFlight = processOutbox(db, mailer)
      .then(() => undefined)
      .catch((error: unknown) => {
        console.error('Falha ao processar a fila de e-mail', error);
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
