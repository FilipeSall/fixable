import { setTimeout as sleep } from 'node:timers/promises';
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/db/client.ts';
import { emailOutbox } from '../../src/models/index.ts';
import { createUser, resetDb } from '../helpers.ts';
import { issueEmailToken } from '../../src/services/email-token.service.ts';
import type { Mailer } from '../../src/types/mail.types.ts';
import { createMemoryMailer } from '../../src/mailers/memory.mailer.ts';
import { enqueueEmail, processOutbox } from '../../src/services/outbox.service.ts';
import { startOutboxWorker } from '../../src/workers/outbox.worker.ts';

const { db, close } = createDb(
  process.env['DATABASE_URL_TEST'] ?? 'postgres://fixable:fixable@localhost:5432/fixable_test',
);
const minutes = (n: number) => n * 60_000;
const message = {
  to: 'ana@fixable.test',
  template: 'convite' as const,
  data: { nome: 'Ana', link: 'https://x/app/convite?token=abc' },
};

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function gatedMailer() {
  const started = deferred();
  const gate = deferred();
  const mailer: Mailer = {
    async send() {
      started.resolve();
      await gate.promise;
    },
  };
  return { mailer, started: started.promise, release: gate.resolve };
}

async function onlyRow() {
  const rows = await db.select().from(emailOutbox);
  return rows[0]!;
}

describe('fila de e-mail', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await close();
  });

  it('envia e marca como enviado', async () => {
    const mailer = createMemoryMailer();
    await enqueueEmail(db, message);
    const result = await processOutbox(db, mailer);
    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]!.to).toBe('ana@fixable.test');
    expect(mailer.sent[0]!.text).toContain('Ana');
    const row = await onlyRow();
    expect(row.status).toBe('enviado');
    expect(row.sentAt).not.toBeNull();
  });

  it('reagenda com backoff após falha e envia depois', async () => {
    const mailer = createMemoryMailer();
    mailer.failNext(1);
    await enqueueEmail(db, message);
    const now = new Date();
    const result = await processOutbox(db, mailer, now);
    expect(result).toEqual({ sent: 0, failed: 1 });
    const row = await onlyRow();
    expect(row.attempts).toBe(1);
    expect(row.status).toBe('pendente');
    expect(row.lastError).toBeTruthy();
    expect(row.nextAttemptAt.getTime()).toBe(now.getTime() + minutes(2));
    const retry = await processOutbox(db, mailer, new Date(now.getTime() + minutes(3)));
    expect(retry).toEqual({ sent: 1, failed: 0 });
  });

  it('marca como falhou após 5 tentativas e não processa mais', async () => {
    const mailer = createMemoryMailer();
    mailer.failNext(10);
    await enqueueEmail(db, message);
    let now = new Date();
    for (let i = 0; i < 5; i += 1) {
      await processOutbox(db, mailer, now);
      now = new Date(now.getTime() + minutes(60));
    }
    const row = await onlyRow();
    expect(row.status).toBe('falhou');
    expect(row.attempts).toBe(5);
    const after = await processOutbox(db, mailer, new Date(now.getTime() + minutes(600)));
    expect(after).toEqual({ sent: 0, failed: 0 });
  });

  it('remove o link dos dados após o envio e mantém as demais chaves', async () => {
    await enqueueEmail(db, message);
    await processOutbox(db, createMemoryMailer());
    expect((await onlyRow()).data).toEqual({ nome: 'Ana' });
  });

  it('mantém o link enquanto pendente após uma falha e remove ao falhar de vez', async () => {
    const mailer = createMemoryMailer();
    mailer.failNext(10);
    await enqueueEmail(db, message);
    let now = new Date();
    await processOutbox(db, mailer, now);
    expect((await onlyRow()).status).toBe('pendente');
    expect((await onlyRow()).data).toEqual(message.data);
    for (let i = 0; i < 4; i += 1) {
      now = new Date(now.getTime() + minutes(60));
      await processOutbox(db, mailer, now);
    }
    const row = await onlyRow();
    expect(row.status).toBe('falhou');
    expect(row.data).toEqual({ nome: 'Ana' });
  });

  it('ignora linhas com próxima tentativa no futuro', async () => {
    const mailer = createMemoryMailer();
    await enqueueEmail(db, message);
    const result = await processOutbox(db, mailer, new Date(Date.now() - minutes(10)));
    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(mailer.sent).toHaveLength(0);
  });

  it('stop do worker só resolve depois que o envio em andamento termina', async () => {
    const { promise: sendStarted, resolve: markSendStarted } = deferred();
    const { promise: sendGate, resolve: releaseSend } = deferred();
    const slowMailer: Mailer = {
      async send() {
        markSendStarted();
        await sendGate;
      },
    };
    await enqueueEmail(db, message);
    const stop = startOutboxWorker(db, slowMailer, 10);
    await sendStarted;

    let stopped = false;
    const stopping = stop().then(() => {
      stopped = true;
    });
    await sleep(50);
    expect(stopped).toBe(false);

    releaseSend();
    await stopping;
    expect((await onlyRow()).status).toBe('enviado');
  });

  it('não segura bloqueio no banco durante o envio e não entrega de novo a linha reservada', async () => {
    const slow = gatedMailer();
    const other = createMemoryMailer();
    await enqueueEmail(db, message);
    const now = new Date();
    const first = processOutbox(db, slow.mailer, now);
    await slow.started;

    await expect(db.execute(sql`SELECT id FROM email_outbox FOR UPDATE NOWAIT`)).resolves.toHaveLength(1);
    expect(await processOutbox(db, other, now)).toEqual({ sent: 0, failed: 0 });
    expect(other.sent).toHaveLength(0);

    slow.release();
    expect(await first).toEqual({ sent: 1, failed: 0 });
    expect((await onlyRow()).status).toBe('enviado');
  });

  it('volta a enviar depois do prazo de reserva quando o processo cai durante o envio', async () => {
    const stuck = gatedMailer();
    await enqueueEmail(db, message);
    const now = new Date();
    void processOutbox(db, stuck.mailer, now);
    await stuck.started;

    const mailer = createMemoryMailer();
    expect(await processOutbox(db, mailer, new Date(now.getTime() + minutes(4)))).toEqual({ sent: 0, failed: 0 });
    expect(await processOutbox(db, mailer, new Date(now.getTime() + minutes(6)))).toEqual({ sent: 1, failed: 0 });
    expect(mailer.sent).toHaveLength(1);
  });

  it('descarta sem enviar o e-mail cujo link expirou antes da entrega', async () => {
    const user = await createUser(db, { role: 'cliente' });
    const issuedAt = new Date();
    const { id } = await issueEmailToken(db, user.id, 'redefinicao', issuedAt);
    await enqueueEmail(db, { ...message, template: 'redefinicao', emailTokenId: id });
    const mailer = createMemoryMailer();

    expect(await processOutbox(db, mailer, new Date(issuedAt.getTime() + minutes(61)))).toEqual({ sent: 0, failed: 0 });

    expect(mailer.sent).toHaveLength(0);
    const row = await onlyRow();
    expect(row.status).toBe('descartado');
    expect(row.data).toEqual({ nome: 'Ana' });
  });
});
