import type { EmailContent, Mail, TemplateData, TemplateName } from '../../types/mail.types.ts';
import { escapeHtml } from '../../utils/html.ts';
import { convite } from './convite.ts';
import { redefinicao } from './redefinicao.ts';

const contents: Record<TemplateName, EmailContent> = { convite, redefinicao };

export function renderTemplate(name: TemplateName, data: TemplateData): Omit<Mail, 'to'> {
  const { subject, intro, action, outro } = contents[name];
  const text = [`Olá, ${data.nome}. ${intro}`, `${action} ${data.link}`, outro]
    .filter((line) => line !== undefined)
    .join('\n\n');
  const nome = escapeHtml(data.nome);
  const link = escapeHtml(data.link);
  const html = [
    `<p>Olá, ${nome}. ${intro}</p>`,
    `<p>${action} <a href="${link}">${link}</a></p>`,
    outro === undefined ? undefined : `<p>${outro}</p>`,
  ]
    .filter((line) => line !== undefined)
    .join('\n');
  return { subject, text, html };
}
