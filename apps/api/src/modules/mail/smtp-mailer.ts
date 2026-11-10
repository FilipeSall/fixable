import { createTransport } from 'nodemailer';
import type { Mailer } from './mailer.ts';

export function createSmtpMailer(connectionUrl: string, from: string): Mailer {
  const transport = createTransport(connectionUrl);
  return {
    async send(mail) {
      await transport.sendMail({ from, ...mail });
    },
  };
}
