import type { EmailTemplate } from '../../types/mail.types.ts';

/** Aviso com o link para redefinir a senha. */
export const redefinicao: EmailTemplate<'redefinicao'> = ({ nome, link }) => ({
  subject: 'Redefinição de senha da Fixable',
  blocks: [
    { kind: 'paragraph', text: `Olá, ${nome}. Recebemos um pedido para redefinir sua senha.` },
    { kind: 'link', text: 'Use o link abaixo (válido por 1 hora):', url: link },
    { kind: 'paragraph', text: 'Se não foi você, ignore este e-mail.' },
  ],
});
