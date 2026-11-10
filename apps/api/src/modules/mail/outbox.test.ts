import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../db/client.ts';
import { emailOutbox } from '../../db/schema/index.ts';
import { resetDb } from '../../../test/helpers.ts';
import { createMemoryMailer } from './memory-mailer.ts';
import { enqueueEmail, processOutbox } from './outbox.ts';

const { db, close } = createDb(
  process.env['DATABASE_URL_TEST'] ?? 'postgres://fixable:fixable@localhost:5432/fixable_test',
);
const minutes = (n: number) => n * 60_000;
const message = {
  to: 'ana@fixable.test',
  template: 'convite' as const,
  data: { nome: 'Ana', link: 'https://x/app/convite?token=abc' },
};

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
});
