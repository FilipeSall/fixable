import type { Mail, Mailer } from './mailer.ts';

export type MemoryMailer = Mailer & { sent: Mail[]; failNext(times: number): void };

export function createMemoryMailer(): MemoryMailer {
  const sent: Mail[] = [];
  let failures = 0;
  return {
    sent,
    failNext(times) {
      failures = times;
    },
    send(mail) {
      if (failures > 0) {
        failures -= 1;
        return Promise.reject(new Error('Falha simulada no envio de e-mail'));
      }
      sent.push(mail);
      return Promise.resolve();
    },
  };
}
