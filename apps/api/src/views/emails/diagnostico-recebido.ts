import type { EmailTemplate } from '../../types/mail.types.ts';

/** Confirmação ao cliente de que a nova solicitação de diagnóstico foi recebida. */
export const diagnosticoRecebido: EmailTemplate<'diagnostico-recebido'> = ({ nome, loginUrl }) => ({
  subject: 'Recebemos sua nova solicitação',
  blocks: [
    { kind: 'paragraph', text: `Olá, ${nome}.` },
    {
      kind: 'paragraph',
      text: 'Recebemos sua nova solicitação de diagnóstico. Seu engenheiro responsável vai entrar em contato. Você também acompanha tudo pela plataforma.',
    },
    { kind: 'link', text: 'Acesse a plataforma:', url: loginUrl },
  ],
});
