import type { EmailTemplate } from '../../types/mail.types.ts';

/** Aviso interno à equipe com os dados de um novo pedido de diagnóstico. */
export const novoLead: EmailTemplate<'novo-lead'> = (data) => ({
  subject: `Novo diagnóstico: ${data.nome} (${data.cidade})`,
  blocks: [
    { kind: 'paragraph', text: 'Chegou um novo pedido de diagnóstico.' },
    {
      kind: 'fields',
      items: [
        ['Nome', data.nome],
        ['E-mail', data.email],
        ['Telefone', data.telefone],
        ['Cidade', data.cidade],
        ['Tipo de imóvel', data.tipoImovel],
        ['Preferência de contato', data.preferenciaContato],
        ['Plano', data.plano],
        ['Descrição', data.descricao],
        ['Engenheiro', data.engenheiro],
      ],
    },
  ],
});
