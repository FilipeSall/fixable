import type { EmailContent } from '../../types/mail.types.ts';

export const redefinicao: EmailContent = {
  subject: 'Redefinição de senha da Fixable',
  intro: 'Recebemos um pedido para redefinir sua senha.',
  action: 'Use o link abaixo (válido por 1 hora):',
  outro: 'Se não foi você, ignore este e-mail.',
};
