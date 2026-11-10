import type { EmailTemplate } from '../../types/mail.types.ts';

/** Aviso interno à equipe com os dados de uma nova candidatura. */
export const novaCandidatura: EmailTemplate<'nova-candidatura'> = (data) => ({
  subject: `Nova candidatura: ${data.nome} (${data.area})`,
  blocks: [
    { kind: 'paragraph', text: 'Chegou uma nova candidatura.' },
    {
      kind: 'fields',
      items: [
        ['Nome', data.nome],
        ['E-mail', data.email],
        ['Telefone', data.telefone],
        ['Cidade', data.cidade],
        ['Área', data.area],
      ],
    },
  ],
});
