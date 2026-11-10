import { and, eq, gt, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { Db, Tx } from '../db/client.ts';
import { emailOutbox, emailTokens } from '../models/index.ts';
import type { Mailer, TemplateData, TemplateName } from '../types/mail.types.ts';
import { renderTemplate } from '../views/emails/render.ts';

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 5;
const MINUTE_MS = 60_000;
const CLAIM_LEASE_MS = 5 * MINUTE_MS;
const withoutLink = sql`${emailOutbox.data} - 'link'`;

type OutboxRow = typeof emailOutbox.$inferSelect;
type DeliveryOutcome = 'enviado' | 'falhou' | 'descartado';

export async function enqueueEmail(
  db: Db | Tx,
  msg: { to: string; template: TemplateName; data: Record<string, string>; emailTokenId?: string },
): Promise<void> {
  await db.insert(emailOutbox).values({
    to: msg.to,
    template: msg.template,
    data: msg.data,
    emailTokenId: msg.emailTokenId,
  });
}

async function claimNext(db: Db, now: Date): Promise<OutboxRow | null> {
  const next = db
    .select({ id: emailOutbox.id })
    .from(emailOutbox)
    .where(and(eq(emailOutbox.status, 'pendente'), lte(emailOutbox.nextAttemptAt, now)))
    .orderBy(emailOutbox.nextAttemptAt)
    .limit(1)
    .for('update', { skipLocked: true });
  const [row] = await db
    .update(emailOutbox)
    .set({
      attempts: sql`${emailOutbox.attempts} + 1`,
      nextAttemptAt: new Date(now.getTime() + CLAIM_LEASE_MS),
    })
    .where(inArray(emailOutbox.id, next))
    .returning();
  return row ?? null;
}

async function isTokenOpen(db: Db, tokenId: string, now: Date): Promise<boolean> {
  const [token] = await db
    .select({ id: emailTokens.id })
    .from(emailTokens)
    .where(and(eq(emailTokens.id, tokenId), isNull(emailTokens.usedAt), gt(emailTokens.expiresAt, now)))
    .limit(1);
  return token !== undefined;
}

async function markFailed(db: Db, row: OutboxRow, error: unknown, now: Date): Promise<void> {
  const exhausted = row.attempts >= MAX_ATTEMPTS;
  await db
    .update(emailOutbox)
    .set({
      status: exhausted ? 'falhou' : 'pendente',
      ...(exhausted ? { data: withoutLink } : {}),
      nextAttemptAt: new Date(now.getTime() + 2 ** row.attempts * MINUTE_MS),
      lastError: error instanceof Error ? error.message : String(error),
    })
    .where(eq(emailOutbox.id, row.id));
}

async function deliver(db: Db, mailer: Mailer, row: OutboxRow, now: Date): Promise<DeliveryOutcome> {
  if (row.emailTokenId && !(await isTokenOpen(db, row.emailTokenId, now))) {
    await db.update(emailOutbox).set({ status: 'descartado', data: withoutLink }).where(eq(emailOutbox.id, row.id));
    return 'descartado';
  }
  try {
    const content = renderTemplate(row.template as TemplateName, row.data as TemplateData);
    await mailer.send({ to: row.to, ...content });
  } catch (error) {
    await markFailed(db, row, error, now);
    return 'falhou';
  }
  await db
    .update(emailOutbox)
    .set({ status: 'enviado', sentAt: now, lastError: null, data: withoutLink })
    .where(eq(emailOutbox.id, row.id));
  return 'enviado';
}

export async function processOutbox(
  db: Db,
  mailer: Mailer,
  now: Date = new Date(),
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (let claimed = 0; claimed < BATCH_SIZE; claimed += 1) {
    const row = await claimNext(db, now);
    if (!row) break;
    const outcome = await deliver(db, mailer, row, now);
    if (outcome === 'enviado') sent += 1;
    if (outcome === 'falhou') failed += 1;
  }
  return { sent, failed };
}
