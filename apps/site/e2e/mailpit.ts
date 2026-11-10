import { expect } from '@playwright/test';
import { mailpitUrl } from './env.ts';

type MessageSummary = { ID: string; To: { Address: string }[] };

/** Apaga todas as mensagens do Mailpit para isolar a execução. */
export async function clearMailbox(): Promise<void> {
  const res = await fetch(`${mailpitUrl}/api/v1/messages`, { method: 'DELETE' });
  expect(res.ok).toBe(true);
}

async function findMessageId(email: string): Promise<string | undefined> {
  const res = await fetch(`${mailpitUrl}/api/v1/messages`);
  const body = (await res.json()) as { messages: MessageSummary[] };
  return body.messages.find((message) => message.To.some((to) => to.Address === email))?.ID;
}

/** Espera o e-mail enviado ao endereço e devolve o link de convite com o token no fragmento. */
export async function readInviteLink(email: string): Promise<string> {
  let id: string | undefined;
  await expect
    .poll(async () => (id = await findMessageId(email)), { timeout: 30_000, intervals: [500] })
    .toBeDefined();
  const res = await fetch(`${mailpitUrl}/api/v1/message/${id}`);
  const { Text } = (await res.json()) as { Text: string };
  const link = /https?:\/\/\S+\/app\/convite#token=\S+/.exec(Text)?.[0];
  if (!link) throw new Error('Link de convite não encontrado no e-mail.');
  return link;
}
