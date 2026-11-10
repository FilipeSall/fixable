import { createTransport } from 'nodemailer';
import type { Mailer } from './mailer.ts';

const CONNECTION_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 20_000;

export function createSmtpMailer(connectionUrl: string, from: string): Mailer {
  const transport = createTransport({
    url: connectionUrl,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  });
  return {
    async send(mail) {
      await transport.sendMail({ from, ...mail });
    },
  };
}
