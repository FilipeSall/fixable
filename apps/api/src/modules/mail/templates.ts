import type { Mail } from './mailer.ts';

export type TemplateName = 'convite' | 'redefinicao';
export type TemplateData = { nome: string; link: string };

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]!);
}

type Content = { subject: string; intro: string; action: string; outro?: string };

const contents: Record<TemplateName, Content> = {
  convite: {
    subject: 'Crie sua senha na Fixable',
    intro: 'Você foi convidado(a) para a plataforma Fixable.',
    action: 'Crie sua senha pelo link abaixo (válido por 48 horas):',
  },
  redefinicao: {
    subject: 'Redefinição de senha da Fixable',
    intro: 'Recebemos um pedido para redefinir sua senha.',
    action: 'Use o link abaixo (válido por 1 hora):',
    outro: 'Se não foi você, ignore este e-mail.',
  },
};

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
