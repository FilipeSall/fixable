export type Mail = { to: string; subject: string; text: string; html: string };

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export type TemplateName = 'convite' | 'redefinicao';
export type TemplateData = { nome: string; link: string };
export type EmailContent = { subject: string; intro: string; action: string; outro?: string };
export type MemoryMailer = Mailer & { sent: Mail[]; failNext(times: number): void };
