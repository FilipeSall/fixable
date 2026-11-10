import type { Mail, MemoryMailer } from '../types/mail.types.ts';

/** Cria um mailer em memória que guarda os e-mails enviados e permite simular falhas nos testes. */
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
