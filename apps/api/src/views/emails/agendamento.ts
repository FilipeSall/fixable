import type { EmailTemplate } from '../../types/mail.types.ts';

/** Aviso ao cliente de que um agendamento do imóvel foi criado ou alterado. */
export const agendamento: EmailTemplate<'agendamento'> = (data) => ({
  subject: `Agendamento ${data.acao}: ${data.servico}`,
  blocks: [
    { kind: 'paragraph', text: `Olá, ${data.nome}. Um agendamento do seu imóvel foi ${data.acao}.` },
    {
      kind: 'fields',
      items: [
        ['Serviço', data.servico],
        ['Imóvel', data.imovel],
        ['Data', data.data],
        ['Horário', data.hora],
        ['Status', data.status],
      ],
    },
    { kind: 'link', text: 'Veja os detalhes na plataforma:', url: data.link },
  ],
});
