import type { EmailTemplate } from '../../types/mail.types.ts';

/** Convite para o usuário criar a própria senha. */
export const convite: EmailTemplate<'convite'> = ({ nome, link }) => ({
  subject: 'Crie sua senha na Fixable',
  blocks: [
    { kind: 'paragraph', text: `Olá, ${nome}. Você foi convidado(a) para a plataforma Fixable.` },
    { kind: 'link', text: 'Crie sua senha pelo link abaixo (válido por 48 horas):', url: link },
  ],
});
