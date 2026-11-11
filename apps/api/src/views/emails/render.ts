import type { EmailBlock, EmailTemplate, Mail, TemplateDataMap, TemplateName } from '../../types/mail.types.ts';
import { escapeHtml } from '../../utils/html.ts';
import { agendamento } from './agendamento.ts';
import { convite } from './convite.ts';
import { diagnosticoRecebido } from './diagnostico-recebido.ts';
import { novaCandidatura } from './nova-candidatura.ts';
import { novoLead } from './novo-lead.ts';
import { redefinicao } from './redefinicao.ts';

const templates: { [N in TemplateName]: EmailTemplate<N> } = {
  convite,
  redefinicao,
  'novo-lead': novoLead,
  'nova-candidatura': novaCandidatura,
  'diagnostico-recebido': diagnosticoRecebido,
  agendamento,
};

/** Converte um bloco de conteúdo em texto simples. */
function blockToText(block: EmailBlock): string {
  if (block.kind === 'paragraph') return block.text;
  if (block.kind === 'link') return `${block.text} ${block.url}`;
  return block.items.map(([label, value]) => `${label}: ${value}`).join('\n');
}

/** Converte um bloco de conteúdo em HTML, escapando todo texto variável. */
function blockToHtml(block: EmailBlock): string {
  if (block.kind === 'paragraph') return `<p>${escapeHtml(block.text)}</p>`;
  if (block.kind === 'link') {
    const url = escapeHtml(block.url);
    return `<p>${escapeHtml(block.text)} <a href="${url}">${url}</a></p>`;
  }
  const rows = block.items.map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`);
  return `<ul>\n${rows.join('\n')}\n</ul>`;
}

/** Monta o assunto, o texto e o HTML do e-mail a partir do template e dos dados. */
export function renderTemplate<N extends TemplateName>(name: N, data: TemplateDataMap[N]): Omit<Mail, 'to'> {
  const render = templates[name] as EmailTemplate<N>;
  const { subject, blocks } = render(data);
  return {
    subject,
    text: blocks.map(blockToText).join('\n\n'),
    html: blocks.map(blockToHtml).join('\n'),
  };
}
